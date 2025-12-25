import { sidebar } from "vuepress-theme-hope";

// docs: https://theme-hope.vuejs.press/zh/guide/layout/sidebar.html

export default sidebar({
  "/": [
    "",

    // {
    //   text: "如何使用",
    //   icon: "laptop-code",
    //   prefix: "demo/",
    //   link: "demo/",
    //   children: "structure",
    // },

    {
      text: "文章",
      icon: "book",
      prefix: "posts/",
      children: "structure",
      collapsible: true, // 当前分组的链接是否可折叠
      expanded: false, // 当前分组的链接是否默认展开
    },

    // 介绍页
    // "intro",

    // {
    //   text: "幻灯片",
    //   icon: "person-chalkboard",
    //   link: "https://plugin-md-enhance.vuejs.press/zh/guide/content/revealjs/demo.html",
    // },
  ],
});
