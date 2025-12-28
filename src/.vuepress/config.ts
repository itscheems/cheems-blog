import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/cheems-blog/",

  lang: "zh-CN",
  title: "Cheems's Blog",
  description: "Cheems 的博客",

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
