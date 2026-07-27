import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://dsanying.github.io',
  base: '/cuhksz',
  output: 'static',
  integrations: [
    starlight({
      title: '港中深资源站',
      description: '面向港中深学生的课程、校园与生活资源导航。',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/dsanying/cuhksz' }],
      customCss: ['./src/styles/global.css'],
      sidebar: [
        {
          label: '新生与校园',
          items: [
            { label: '入学清单', link: '/checklist/' },
            { label: '学校联系方式', link: '/contact-school/' },
            { label: '书院信息', link: '/dorm/' },
            { label: '医保指南', link: '/medical-insurance/' },
            { label: '校园地图', link: '/map/' },
          ],
        },
        {
          label: '学业与课程',
          items: [
            { label: '课程资料与电子课本', link: '/course/' },
            { label: '自由选修 PF 课程推荐', link: '/guide-lgu-4/' },
            { label: '跨学院转专业攻略', link: '/guide-lgu-3/' },
            { label: 'SALL Centre 使用指南', link: '/guide-lgu-5/' },
            { label: '教科书与论文文献获取', link: '/guide-lgu-6/' },
            { label: 'CEC1010', link: '/cec1010/' },
            { label: '体育课测评', link: '/ped/' },
          ],
        },
        {
          label: '数字校园与生活',
          items: [
            { label: 'IT 指南', link: '/guide-it/' },
            { label: '快速上手 SIS', link: '/guide-lgu-2/' },
            { label: '重要资料', link: '/material/' },
            { label: '周边美食推荐', link: '/guide-lgu-1/' },
            { label: '社交媒体与宝藏资源', link: '/social/' },
          ],
        },
      ],
    }),
  ],
});
