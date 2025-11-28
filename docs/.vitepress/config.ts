import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Shield Finance',
  description: 'XRP Liquid Staking on Flare Network - Documentation & Legal',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#10B981' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Shield Finance' }],
  ],
  
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Shield Finance',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Protocol', link: '/protocol/SHIELD_TOKENOMICS' },
      { text: 'Whitepaper', link: 'https://shyield.finance/whitepaper.pdf' },
      { text: 'App', link: 'https://shyield.finance' },
      {
        text: 'Legal',
        items: [
          { text: 'Privacy Policy', link: '/legal/privacy-policy' },
          { text: 'Terms of Service', link: '/legal/terms-of-service' },
          { text: 'Cookie Policy', link: '/legal/cookie-policy' },
        ]
      }
    ],
    
    sidebar: {
      '/protocol/': [
        {
          text: 'Protocol',
          items: [
            { text: 'Whitepaper', link: 'https://shyield.finance/whitepaper.pdf' },
            { text: 'SHIELD Tokenomics', link: '/protocol/SHIELD_TOKENOMICS' },
            { text: 'Deployment', link: '/protocol/SHIELD_DEPLOYMENT' },
            { text: 'Staking Boost', link: '/protocol/STAKING_BOOST_SPEC' },
            { text: 'Security Checklist', link: '/protocol/SHIELD_SECURITY_CHECKLIST' },
          ]
        }
      ],
      '/integration/': [
        {
          text: 'Integration',
          items: [
            { text: 'FAssets Guide', link: '/integration/FASSETS_INTEGRATION_GUIDE' },
            { text: 'Firelight', link: '/integration/FIRELIGHT_INTEGRATION' },
            { text: 'Flare FAssets', link: '/integration/FLARE_FASSETS_INTEGRATION' },
            { text: 'LP Locking', link: '/integration/LP_LOCKING_GUIDE' },
          ]
        }
      ],
      '/platform/': [
        {
          text: 'Platform',
          items: [
            { text: 'Smart Accounts', link: '/platform/SMART_ACCOUNTS_SPEC' },
            { text: 'Swap', link: '/platform/swap' },
            { text: 'Wallet Integration', link: '/platform/wallet-integration' },
            { text: 'Transaction Signing', link: '/platform/transaction-signing' },
            { text: 'Xaman Integration', link: '/platform/xaman-integration' },
          ]
        }
      ],
      '/legal/': [
        {
          text: 'Legal',
          items: [
            { text: 'Privacy Policy', link: '/legal/privacy-policy' },
            { text: 'Terms of Service', link: '/legal/terms-of-service' },
            { text: 'Cookie Policy', link: '/legal/cookie-policy' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API',
          items: [
            { text: 'Overview', link: '/api/README' },
          ]
        }
      ],
    },
    
    socialLinks: [
      { icon: 'twitter', link: 'https://twitter.com/shyieldfinance' },
      { icon: 'github', link: 'https://github.com/shyieldfinance' },
    ],
    
    footer: {
      message: 'Non-custodial DeFi protocol. Use at your own risk.',
      copyright: '© 2025 Shield Finance. All rights reserved.'
    },
    
    search: {
      provider: 'local'
    },
    
    editLink: {
      pattern: 'https://github.com/shyieldfinance/docs/edit/main/:path',
      text: 'Edit this page'
    }
  }
})
