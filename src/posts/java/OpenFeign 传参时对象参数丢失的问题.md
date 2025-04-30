---
title: OpenFeign 传参时对象参数丢失的问题
date: 2022-05-25
category:
  - java
tag:
  - java

# 摘要
excerpt: <p>在使用 OpenFeign 调用 b 微服务时，传递对象参数时，对象参数为 null，这个错误我找了一两周。。</p>
---

## 错误代码

调用方 FeignClient 接口

```java
@PostMapping("getList/{currentPage}/{limit}")
CommonResult getList(@PathVariable("currentPage") Integer currentPage,
                     @PathVariable("limit") Integer limit,
                     HospitalQueryVo hospitalQueryVo);
```

服务提供方 Controller 接口

```java
@PostMapping("getList/{currentPage}/{limit}")
public CommonResult getList(@PathVariable("currentPage") Integer currentPage,
                            @PathVariable("limit") Integer limit,
                            @RequestBody HospitalQueryVo hospitalQueryVo) {
    
    /* 此时的 hospitalQueryVo 参数是 null */
    
    Page<Hospital> page = hospitalService.getList(currentPage,limit,hospitalQueryVo);
    page.getContent();
    return new CommonResult(ResultCodeEnum.SUCCESS,page);
}
```

分页条件查询的条件对象 `hospitalQueryVo` 为 null，获取不到，所以导致每次查询都是 “查询所有”

## 图片描述

（A微服务 调用 B微服务）

<!-- ![80P.png](./048d7208-c235-4940-8bab-d7c82769254b.png) -->
<!-- <img src="./048d7207c82769254b.png"/> -->
<img :src="$withBase('/048d7207c82769254b.png')" >

## 原因分析

传递对象时，Feign 会将请求变成 POST 请求，所以要**在 FeignClient 接口，以及 b 微服务 Controller 接口方**，要写成 PostMapping，并在对象参数上加上 `@RequestBody` 注解！

前端以什么方式提交给 a 微服务都无所谓，最主要是 FeignClient 和 b 微服务接口方的控制！ 我出错的原因就是因为在接收参数时，没在对象参数上加上 `@RequestBody` 注解。

## 更正后代码

调用方 FeignClient 接口

```java
@PostMapping("getList/{currentPage}/{limit}")
CommonResult getList(@PathVariable("currentPage") Integer currentPage,
                     @PathVariable("limit") Integer limit,
                     @RequestBody HospitalQueryVo hospitalQueryVo);
// 切记切记切记！！！！！这里的 HospitalQueryVo 对象参数一定要写 @RequestBody 注解！！！
// 切记切记切记！！！！！这里的 HospitalQueryVo 对象参数一定要写 @RequestBody 注解！！！
// 切记切记切记！！！！！这里的 HospitalQueryVo 对象参数一定要写 @RequestBody 注解！！！
```

服务提供方 Controller 接口

```java
@PostMapping("getList/{currentPage}/{limit}")
public CommonResult getList(@PathVariable("currentPage") Integer currentPage,
                            @PathVariable("limit") Integer limit,
                            @RequestBody HospitalQueryVo hospitalQueryVo) {
    
    Page<Hospital> page = hospitalService.getList(currentPage,limit,hospitalQueryVo);
    page.getContent();
    return new CommonResult(ResultCodeEnum.SUCCESS,page);
}
```

## 总结

传递对象参数时，要用 POST 方式在双方传递

> 1、在调用方 FeignClient 接口对象参数前加 `@RequestBody`
>
> 2、在服务提供方 Controller 对象参数前加 `@RequestBody`
