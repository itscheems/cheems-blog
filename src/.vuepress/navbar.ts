import { navbar } from "vuepress-theme-hope";

// 
export default navbar([
  "/",
  
  //////////////// 可以直接添加目录
  // "/demo/",
  
  ////////////////
  // {
  //   text: "博文",
  //   icon: "pen-to-square",
  //   // 根路径
  //   prefix: "/posts/",
  //   children: [
  //     {
  //       text: "苹果",
  //       icon: "pen-to-square",
  //       // 子路径
  //       prefix: "apple/",
  //       children: [
  //         { text: "苹果1", icon: "pen-to-square", link: "1" }, // 省略：1.md
  //       //{ text: "苹果2", icon: "pen-to-square", link: "2" },
  //         "2", // 如果是按顺序，那也可这样子省略来写，但不推荐
  //         "3",
  //         "4",
  //       ],
  //     },
  //     {
  //       text: "香蕉",
  //       icon: "pen-to-square",
  //       prefix: "banana/",
  //       children: [
  //         {
  //           text: "香蕉 1",
  //           icon: "pen-to-square",
  //           link: "1",
  //         },
  //         {
  //           text: "香蕉 2",
  //           icon: "pen-to-square",
  //           link: "2",
  //         },
  //         "3",
  //         "4",
  //       ],
  //     },
  //     { text: "樱桃", icon: "pen-to-square", link: "cherry" },
  //     { text: "火龙果", icon: "pen-to-square", link: "dragonfruit" },
  //     "tomato",
  //     "strawberry",
  //   ],
  // },

  ////////////////
  // {
  //   text: "V2 文档",
  //   icon: "book",
  //   link: "https://theme-hope.vuejs.press/zh/",
  // },
]);
