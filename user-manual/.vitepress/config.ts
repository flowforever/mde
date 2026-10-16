import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/mde/',
  description: 'MDE public user manual',
  lang: 'zh-CN',
  lastUpdated: true,
  title: 'MDE 用户手册',
  themeConfig: {
    nav: [
      { link: '/zh-CN/', text: '首页' },
      { link: '/zh-CN/quick-start', text: '快速开始' },
      { link: 'https://github.com/flowforever/mde/releases', text: '下载' }
    ],
    sidebar: {
      '/zh-CN/': [
        {
          items: [
            { link: '/zh-CN/', text: '概览' },
            { link: '/zh-CN/quick-start', text: '快速开始' },
            { link: '/zh-CN/workspace', text: '工作区与文件' },
            { link: '/zh-CN/editor', text: '编辑 Markdown' },
            { link: '/zh-CN/search', text: '搜索' },
            { link: '/zh-CN/links', text: '链接' },
            { link: '/zh-CN/ai', text: 'AI Summary 和 Translation' },
            { link: '/zh-CN/settings', text: '设置' },
            { link: '/zh-CN/troubleshooting', text: '常见问题' }
          ],
          text: '用户手册'
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/flowforever/mde' }]
  }
})
