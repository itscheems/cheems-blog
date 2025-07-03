import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/cjayjay-blog/",

  lang: "zh-CN",
  title: "C JayJay's Blog",
  description: "chenjiaa 的博客",

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
