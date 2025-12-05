import { TwitterApi } from 'twitter-api-v2';

interface DonationData {
  name: string;
  amount: string | number;
  currency: string;
  message?: string;
}

class TwitterService {
  private client: TwitterApi | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    if (apiKey && apiSecret && accessToken && accessSecret) {
      try {
        this.client = new TwitterApi({
          appKey: apiKey,
          appSecret: apiSecret,
          accessToken: accessToken,
          accessSecret: accessSecret,
        });
        this.isConfigured = true;
        console.log('✅ TwitterService initialized');
      } catch (error) {
        console.error('❌ TwitterService initialization failed:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('⚠️ TwitterService: Missing credentials, tweets will be logged only');
      this.isConfigured = false;
    }
  }

  async postDonationThankYou(donation: DonationData): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    const tweetText = this.formatDonationTweet(donation);
    
    if (!this.isConfigured || !this.client) {
      console.log('📝 [Twitter - DRY RUN] Would post tweet:', tweetText);
      return { success: true, tweetId: 'dry-run' };
    }

    try {
      const tweet = await this.client.v2.tweet(tweetText);
      console.log('🐦 Tweet posted successfully:', tweet.data.id);
      return { success: true, tweetId: tweet.data.id };
    } catch (error: any) {
      console.error('❌ Error posting tweet:', error.message || error);
      if (error.data) {
        console.error('   Twitter API response:', JSON.stringify(error.data, null, 2));
      }
      if (error.code) {
        console.error('   Error code:', error.code);
      }
      return { success: false, error: error.message || 'Failed to post tweet' };
    }
  }

  private formatDonationTweet(donation: DonationData): string {
    const name = donation.name || 'Anonymous';
    const amount = donation.amount;
    const currency = donation.currency || 'XRP';
    
    let tweet = `Thank you "${name}" for your generous donation of ${amount} ${currency} 🙏\n\nhttps://xpert.page/p/shieldfinance`;
    
    if (tweet.length > 280) {
      tweet = `Thank you "${name}" for your ${amount} ${currency} donation! 🙏\n\nhttps://xpert.page/p/shieldfinance`;
    }
    
    return tweet;
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const twitterService = new TwitterService();
