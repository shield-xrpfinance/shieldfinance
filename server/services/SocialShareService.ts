import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';
import { db } from '../db';
import { userPoints } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
}

export const socialShareService = SocialShareService.getInstance();
