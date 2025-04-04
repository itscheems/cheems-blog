---
title: Install TypeScript in the VsCode/Cursor/Trae
# 背景图片
# cover: ./祢豆子1.jpg

date: 2025-04-01

# 分类（可填多个）
# category:
#   - 计算机基础

#标签（可填多个）
# tag: 
#   - kubernetes

star: true

# 置顶
sticky: false

# 摘要
excerpt: <p> </p>
---

# Install TypeScript in the VsCode/Cursor/Trae

## Step 1
Install `Node.js`, you can install from the official website

```
https://nodejs.org/en
```

## Step 2
Download some plugins in VsCode/Cursor/Trae

- Code Runner
- JavaScript and TypeScript Nightly
- TypeScript Extension Pack


## Step 3
> The following command should be executed in the command line.

Set the registry in CMD
> You can fine more about registry in the blog below.
> Blog: https://cloud.tencent.com/developer/article/2483549
``` bash
npm config set registry https://registry.npmmirror.com/
```

Download TypeScript

> https://www.typescriptlang.org/zh/download/

``` bash
npm install typescript --save-dev

npx tsc

npm install -g ts-node
```

## Step 4
Add a `tsconfig.json` file in the project's root directory

``` json
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

## You can run following demo

``` ts
function main() {
    let arr: number[] = [5, 2, 8, 12, 3];
    quickSort(arr, 0, arr.length - 1);
    console.log("arr:", arr);
}

function quickSort(arr: number[], low: number, high: number): void {
    if (low < high) {
        let pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}

function partition(arr: number[], low: number, high: number): number {
    let pivot = arr[high]; // pivot
    let i = (low - 1); // Index of smaller element

    for (let j = low; j < high; j++) {
        // If current element is smaller than or
        // equal to pivot
        if (arr[j] <= pivot) {
            i++;

            // swap temp and arr[i]
            let temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
    }

    // swap arr[i+1] and arr[high] (or pivot)
    let temp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = temp;

    return i + 1;
}

// call main function
main();
```

## Architecture

```
.
├── node_modules
│   └── ...
├── package-lock.json
├── package.json
├── src
│   └── demo.ts
└── tsconfig.json
```

## TypeScript Tutorial

- https://www.typescriptlang.org/zh/docs/
- https://github.com/mqyqingfeng/learn-typescript?tab=readme-ov-file
    - https://github.com/mqyqingfeng/Blog/issues/227
    - https://ts.yayujs.com/handbook/TheBasics.html