import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';
import { db } from '../db';
import { userPoints, pendingSocialShares, type PendingSocialShare, type PendingSocialShareStatus } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

interface TwitterTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface ShareContent {
  walletAddress: string;
  referralCode: string;
  totalPoints: number;
  tier: string;
  type: 'referral' | 'airdrop_claim';
}

interface PendingShareResult {
  id: number;
  expiresAt: Date;
  expectedContent: string;
}

interface VerificationResult {
  success: boolean;
  tweetId?: string;
  twitterUsername?: string;
  pointsAwarded?: number;
  error?: string;
  status?: PendingSocialShareStatus;
}

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';
const CALLBACK_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/twitter/callback`
  : 'http://localhost:5000/api/twitter/callback';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

const tokenStore = new Map<string, TwitterTokens>();
const codeVerifierStore = new Map<string, string>();
const stateStore = new Map<string, { walletAddress: string; shareType: string }>();

export class SocialShareService {
  private static instance: SocialShareService;

  public static getInstance(): SocialShareService {
    if (!SocialShareService.instance) {
      SocialShareService.instance = new SocialShareService();
    }
    return SocialShareService.instance;
  }

  generateAuthUrl(walletAddress: string, shareType: string = 'referral'): { url: string; state: string } {
    if (!TWITTER_CLIENT_ID) {
      throw new Error('Twitter Client ID not configured');
    }

    const client = new TwitterApi({ clientId: TWITTER_CLIENT_ID, clientSecret: TWITTER_CLIENT_SECRET });
    
    const state = crypto.randomBytes(16).toString('hex');
    const { url, codeVerifier } = client.generateOAuth2AuthLink(CALLBACK_URL, {
      scope: SCOPES,
      state,
    });

    codeVerifierStore.set(state, codeVerifier);
    stateStore.set(state, { walletAddress, shareType });

    setTimeout(() => {
      codeVerifierStore.delete(state);
      stateStore.delete(state);
    }, 10 * 60 * 1000);

    return { url, state };
  }

  async handleCallback(code: string, state: string): Promise<{ success: boolean; walletAddress?: string; shareType?: string; error?: string }> {
    const codeVerifier = codeVerifierStore.get(state);
    const stateData = stateStore.get(state);

    if (!codeVerifier || !stateData) {
      return { success: false, error: 'Invalid or expired state' };
    }

    try {
      const client = new TwitterApi({ clientId: TWITTER_CLIENT_ID, clientSecret: TWITTER_CLIENT_SECRET });
      
      const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: CALLBACK_URL,
      });

      tokenStore.set(stateData.walletAddress.toLowerCase(), {
        accessToken,
        refreshToken: refreshToken || '',
        expiresAt: Date.now() + (expiresIn * 1000) - 60000,
      });

      codeVerifierStore.delete(state);
      stateStore.delete(state);

      return { success: true, walletAddress: stateData.walletAddress, shareType: stateData.shareType };
    } catch (error) {
      console.error('[SocialShareService] OAuth callback error:', error);
      return { success: false, error: 'Failed to authenticate with X' };
    }
  }

  async refreshTokenIfNeeded(walletAddress: string): Promise<boolean> {
    const tokens = tokenStore.get(walletAddress.toLowerCase());
    if (!tokens) return false;

    if (Date.now() < tokens.expiresAt) {
      return true;
    }

    if (!tokens.refreshToken) {
      tokenStore.delete(walletAddress.toLowerCase());
      return false;
    }

    try {
      const client = new TwitterApi({ clientId: TWITTER_CLIENT_ID, clientSecret: TWITTER_CLIENT_SECRET });
      const { accessToken, refreshToken, expiresIn } = await client.refreshOAuth2Token(tokens.refreshToken);

      tokenStore.set(walletAddress.toLowerCase(), {
        accessToken,
        refreshToken: refreshToken || tokens.refreshToken,
        expiresAt: Date.now() + (expiresIn * 1000) - 60000,
      });

      return true;
    } catch (error) {
      console.error('[SocialShareService] Token refresh error:', error);
      tokenStore.delete(walletAddress.toLowerCase());
      return false;
    }
  }

  isConnected(walletAddress: string): boolean {
    return tokenStore.has(walletAddress.toLowerCase());
  }

  disconnect(walletAddress: string): void {
    tokenStore.delete(walletAddress.toLowerCase());
  }

  async postReferralTweet(content: ShareContent): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    const tokens = tokenStore.get(content.walletAddress.toLowerCase());
    if (!tokens) {
      return { success: false, error: 'Not connected to X. Please authorize first.' };
    }

    const isValid = await this.refreshTokenIfNeeded(content.walletAddress);
    if (!isValid) {
      return { success: false, error: 'X session expired. Please reconnect.' };
    }

    const updatedTokens = tokenStore.get(content.walletAddress.toLowerCase())!;

    try {
      const client = new TwitterApi(updatedTokens.accessToken);

      // Always use production URL for shared links
      const appUrl = 'https://shyield.finance';

      let tweetText: string;
      
      if (content.type === 'airdrop_claim') {
        tweetText = `🎉 Just claimed my $SHIELD airdrop on @ShieldFinanceX!\n\n` +
          `💎 ${content.tier.charAt(0).toUpperCase() + content.tier.slice(1)} tier with ${content.totalPoints.toLocaleString()} points\n\n` +
          `Join the testnet and earn your share of 2M $SHIELD tokens!\n\n` +
          `👉 Use my code: ${content.referralCode}\n` +
          `🔗 ${appUrl}/app/airdrop?ref=${content.referralCode}\n\n` +
          `#ShieldFinance #XRP #Flare #Airdrop #DeFi`;
      } else {
        tweetText = `🛡️ Earning points on @ShieldFinanceX\n\n` +
          `📊 Current stats:\n` +
          `• ${content.totalPoints.toLocaleString()} points earned\n` +
          `• ${content.tier.charAt(0).toUpperCase() + content.tier.slice(1)} tier\n\n` +
          `💰 Invite friends and earn 50 points per referral!\n\n` +
          `👉 Use my code: ${content.referralCode}\n` +
          `🔗 ${appUrl}/app/airdrop?ref=${content.referralCode}\n\n` +
          `#ShieldFinance #XRP #Flare #Testnet #DeFi`;
      }

      const { data } = await client.v2.tweet(tweetText);

      await this.awardSocialPoints(content.walletAddress);

      console.log(`[SocialShareService] Tweet posted successfully: ${data.id}`);
      return { success: true, tweetId: data.id };
    } catch (error: any) {
      console.error('[SocialShareService] Tweet post error:', error);
      
      if (error.code === 403) {
        return { success: false, error: 'Unable to post: Your X app may need elevated permissions or you have reached the rate limit.' };
      }
      if (error.code === 429) {
        return { success: false, error: 'Rate limit reached. Please try again later.' };
      }
      
      return { success: false, error: 'Failed to post tweet. Please try again.' };
    }
  }

  private async awardSocialPoints(walletAddress: string): Promise<void> {
    try {
      const normalizedAddress = walletAddress.toLowerCase();
      
      const existingUser = await db.select().from(userPoints).where(eq(userPoints.walletAddress, normalizedAddress)).limit(1);
      
      if (existingUser.length > 0) {
        const user = existingUser[0];
        await db.update(userPoints)
          .set({
            socialPoints: (user.socialPoints || 0) + 10,
            totalPoints: (user.totalPoints || 0) + 10,
            updatedAt: new Date(),
          })
          .where(eq(userPoints.walletAddress, normalizedAddress));
        
        console.log(`[SocialShareService] Awarded 10 social points to ${normalizedAddress}`);
      }
    } catch (error) {
      console.error('[SocialShareService] Error awarding social points:', error);
    }
  }

  generateShareUrl(referralCode: string): string {
    // Always use production URL for shared links
    const appUrl = 'https://shyield.finance';
    return `${appUrl}/app/airdrop?ref=${referralCode}`;
  }

  generateIntentUrl(content: ShareContent): string {
    // Always use production URL for shared links (better for SEO and consistency)
    const appUrl = 'https://shyield.finance';

    let tweetText: string;
    
    if (content.type === 'airdrop_claim') {
      tweetText = `🎉 Just claimed my $SHIELD airdrop on @ShieldFinanceX!\n\n` +
        `💎 ${content.tier.charAt(0).toUpperCase() + content.tier.slice(1)} tier with ${content.totalPoints.toLocaleString()} points\n\n` +
        `Join the testnet and earn your share of 2M $SHIELD tokens!\n\n` +
        `👉 Use my code: ${content.referralCode}\n` +
        `🔗 ${appUrl}/app/airdrop?ref=${content.referralCode}\n\n` +
        `#ShieldFinance #XRP #Flare #Airdrop #DeFi`;
    } else {
      tweetText = `🛡️ Earning points on @ShieldFinanceX\n\n` +
        `📊 Current stats:\n` +
        `• ${content.totalPoints.toLocaleString()} points earned\n` +
        `• ${content.tier.charAt(0).toUpperCase() + content.tier.slice(1)} tier\n\n` +
        `💰 Invite friends and earn 50 points per referral!\n\n` +
        `👉 Use my code: ${content.referralCode}\n` +
        `🔗 ${appUrl}/app/airdrop?ref=${content.referralCode}\n\n` +
        `#ShieldFinance #XRP #Flare #Testnet #DeFi`;
    }

    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  }

  // ============================================================================
  // PENDING SHARE & VERIFICATION METHODS
  // ============================================================================

  /**
   * Create a pending share record when user initiates intent-based sharing.
   * Points will only be awarded after tweet verification.
   */
  async createPendingShare(content: ShareContent): Promise<PendingShareResult> {
    const normalizedAddress = content.walletAddress.toLowerCase();
    
    // Expected content markers to search for in the tweet
    const expectedContent = `${content.referralCode},@ShieldFinanceX,#ShieldFinance`;
    
    // Expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const [pendingShare] = await db.insert(pendingSocialShares).values({
      walletAddress: normalizedAddress,
      referralCode: content.referralCode,
      shareType: content.type,
      expectedContent,
      expiresAt,
    }).returning();
    
    console.log(`[SocialShareService] Created pending share ${pendingShare.id} for ${normalizedAddress}`);
    
    return {
      id: pendingShare.id,
      expiresAt,
      expectedContent,
    };
  }

  /**
   * Get pending shares for a wallet address
   */
  async getPendingShares(walletAddress: string): Promise<PendingSocialShare[]> {
    const normalizedAddress = walletAddress.toLowerCase();
    
    return db.select()
      .from(pendingSocialShares)
      .where(
        and(
          eq(pendingSocialShares.walletAddress, normalizedAddress),
          eq(pendingSocialShares.status, 'pending')
        )
      );
  }

  /**
   * Get a specific pending share by ID
   */
  async getPendingShareById(shareId: number): Promise<PendingSocialShare | null> {
    const [share] = await db.select()
      .from(pendingSocialShares)
      .where(eq(pendingSocialShares.id, shareId))
      .limit(1);
    
    return share || null;
  }

  /**
   * Verify that a tweet was actually posted by searching user's recent tweets.
   * Awards points only if tweet is found and matches expected content.
   */
  async verifyTweetPosted(
    walletAddress: string, 
    pendingShareId: number
  ): Promise<VerificationResult> {
    const normalizedAddress = walletAddress.toLowerCase();
    const tokens = tokenStore.get(normalizedAddress);
    
    if (!tokens) {
      return { 
        success: false, 
        error: 'Not connected to X. Please connect your account first.',
        status: 'pending'
      };
    }

    // Get the pending share
    const pendingShare = await this.getPendingShareById(pendingShareId);
    if (!pendingShare) {
      return { success: false, error: 'Pending share not found' };
    }
    
    if (pendingShare.walletAddress !== normalizedAddress) {
      return { success: false, error: 'Wallet address mismatch' };
    }
    
    if (pendingShare.status !== 'pending') {
      return { 
        success: pendingShare.status === 'verified',
        status: pendingShare.status as PendingSocialShareStatus,
        tweetId: pendingShare.tweetId || undefined,
        pointsAwarded: pendingShare.pointsAwarded || 0,
        error: pendingShare.status === 'expired' ? 'Share verification expired' : 
               pendingShare.status === 'failed' ? 'Tweet verification failed' : undefined
      };
    }
    
    // Check if expired
    if (new Date() > pendingShare.expiresAt) {
      await db.update(pendingSocialShares)
        .set({ 
          status: 'expired',
          lastVerificationAttempt: new Date(),
        })
        .where(eq(pendingSocialShares.id, pendingShareId));
      
      return { success: false, status: 'expired', error: 'Verification window expired (24 hours)' };
    }

    // Refresh token if needed
    const isValid = await this.refreshTokenIfNeeded(walletAddress);
    if (!isValid) {
      return { 
        success: false, 
        error: 'X session expired. Please reconnect.',
        status: 'pending'
      };
    }

    const updatedTokens = tokenStore.get(normalizedAddress)!;
    
    // Update verification attempt count
    await db.update(pendingSocialShares)
      .set({
        lastVerificationAttempt: new Date(),
        verificationAttempts: sql`${pendingSocialShares.verificationAttempts} + 1`,
      })
      .where(eq(pendingSocialShares.id, pendingShareId));

    try {
      const client = new TwitterApi(updatedTokens.accessToken);
      
      // Get authenticated user info
      const { data: me } = await client.v2.me();
      
      // Get user's recent tweets (last 10)
      const timeline = await client.v2.userTimeline(me.id, {
        max_results: 10,
        'tweet.fields': ['created_at', 'text'],
      });
      
      const tweets = timeline.data?.data || [];
      
      if (!tweets || tweets.length === 0) {
        return { 
          success: false, 
          error: 'No recent tweets found. Please post your share on X first.',
          status: 'pending'
        };
      }

      // Search for matching tweet - look for referral code and @ShieldFinanceX mention
      const expectedMarkers = pendingShare.expectedContent.split(',');
      const referralCode = expectedMarkers[0]; // Primary identifier
      
      const matchingTweet = tweets.find((tweet: { id: string; text: string }) => {
        const text = tweet.text.toLowerCase();
        const hasReferralCode = text.includes(referralCode.toLowerCase());
        const hasMention = text.includes('@shieldfinancex');
        return hasReferralCode && hasMention;
      });

      if (!matchingTweet) {
        // Check if they have too many attempts
        const currentShare = await this.getPendingShareById(pendingShareId);
        if (currentShare && currentShare.verificationAttempts >= 5) {
          await db.update(pendingSocialShares)
            .set({ 
              status: 'failed',
              errorMessage: 'Max verification attempts reached',
            })
            .where(eq(pendingSocialShares.id, pendingShareId));
          
          return { 
            success: false, 
            status: 'failed',
            error: 'Maximum verification attempts reached. Please create a new share.'
          };
        }
        
        return { 
          success: false, 
          error: `Tweet not found. Make sure your post includes your referral code (${referralCode}) and mentions @ShieldFinanceX.`,
          status: 'pending'
        };
      }

      // Tweet found! Award points and update status
      await db.update(pendingSocialShares)
        .set({
          status: 'verified',
          tweetId: matchingTweet.id,
          twitterUsername: me.username,
          verifiedAt: new Date(),
          pointsAwarded: 10,
        })
        .where(eq(pendingSocialShares.id, pendingShareId));

      // Award social points
      await this.awardSocialPoints(walletAddress);
      
      console.log(`[SocialShareService] Tweet verified for ${normalizedAddress}: ${matchingTweet.id}`);
      
      return {
        success: true,
        tweetId: matchingTweet.id,
        twitterUsername: me.username,
        pointsAwarded: 10,
        status: 'verified',
      };
      
    } catch (error: any) {
      console.error('[SocialShareService] Tweet verification error:', error);
      
      let errorMessage = 'Failed to verify tweet. Please try again.';
      
      if (error.code === 429) {
        errorMessage = 'Rate limit reached. Please try again in a few minutes.';
      } else if (error.code === 401 || error.code === 403) {
        errorMessage = 'X authorization expired. Please reconnect your account.';
        tokenStore.delete(normalizedAddress);
      }
      
      await db.update(pendingSocialShares)
        .set({ errorMessage })
        .where(eq(pendingSocialShares.id, pendingShareId));
      
      return { success: false, error: errorMessage, status: 'pending' };
    }
  }

  /**
   * Expire old pending shares (run periodically)
   */
  async expireOldShares(): Promise<number> {
    const result = await db.update(pendingSocialShares)
      .set({ status: 'expired' })
      .where(
        and(
          eq(pendingSocialShares.status, 'pending'),
          lt(pendingSocialShares.expiresAt, new Date())
        )
      )
      .returning();
    
    if (result.length > 0) {
      console.log(`[SocialShareService] Expired ${result.length} pending shares`);
    }
    
    return result.length;
  }

  /**
   * Check if user has already shared recently (prevent spam)
   * Returns true if user has shared in the last 24 hours
   */
  async hasRecentShare(walletAddress: string): Promise<boolean> {
    const normalizedAddress = walletAddress.toLowerCase();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [recent] = await db.select()
      .from(pendingSocialShares)
      .where(
        and(
          eq(pendingSocialShares.walletAddress, normalizedAddress),
          eq(pendingSocialShares.status, 'verified'),
          sql`${pendingSocialShares.verifiedAt} > ${oneDayAgo}`
        )
      )
      .limit(1);
    
    return !!recent;
  }
}

export const socialShareService = SocialShareService.getInstance();
