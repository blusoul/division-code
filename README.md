# 中国行政区划代码数据 -- 未完结版

## 编码规则 引自[维基百科](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%8D%8E%E4%BA%BA%E6%B0%91%E5%85%B1%E5%92%8C%E5%9B%BD%E8%A1%8C%E6%94%BF%E5%8C%BA%E5%88%92%E4%BB%A3%E7%A0%81)

> 代码从左至右的含义是：  
第一、二位表示省级行政单位（省、自治区、直辖市、特别行政区），其中第一位代表大区。  
第三、四位表示地级行政单位（地级市、地区、自治州、盟及省级单位直属县级单位的汇总码）。  
&emsp;&emsp;对于省（自治区）下属单位：01-20，51-70表示省辖市（地级市）；21-50表示地区（自治州、盟）；90表示省（自治区）直辖县级行政区划的汇总。  
&emsp;&emsp;对于直辖市下属单位：01表示市辖区的汇总；02表示县的汇总。  
第五、六位表示县级行政单位（县、自治县、市辖区、县级市、旗、自治旗、林区、特区）。  
&emsp;&emsp;对于地级市下属单位：01-20表示市辖区（特区）；21-80表示县（旗、自治县、自治旗、林区）；81-99表示地级市代管的县级市。  
&emsp;&emsp;对于直辖市所辖县级行政单位：01-20、51-80代表市辖区；21-50代表县（自治县）。  
&emsp;&emsp;对于地区（自治州、盟）下属单位：01-20表示县级市；21-80表示县（旗、自治县、自治旗）。  
&emsp;&emsp;对于省级直辖县级行政单位：同地区。


## 数据来源：

* [中华人民共和国民政部-2017年3月中华人民共和国县以上行政区划代码](http://www.mca.gov.cn/article/sj/tjbz/a/2017/201703/201705051139.html)

* [中华人民共和国国家统计局-2015年统计用区划代码和城乡划分代码(截止2015年09月30日)](http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2015/index.html)

* [中华人民共和国民政部-2013年中华人民共和国县以下行政区划代码](http://files2.mca.gov.cn/cws/201404/20140404125738290.htm)

* [中华人民共和国民政部-中华人民共和国行政区划代码](http://www.mca.gov.cn/article/sj/tjbz/a/)

* [中华人民共和国国家统计局>>统计数据](http://www.stats.gov.cn/tjsj/)

* [中华人民共和国国家统计局>>统计用区划和城乡划分代码](http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/)

* [中华人民共和国民政部-服务-政策解答-区划地名](http://www.mca.gov.cn/article/fw/zcjd/qhdm/)

* [地名普查办--系统维护中](http://dmpc.mca.gov.cn/)

* [博雅地名分享网](http://www.tcmap.com.cn/)

## 用法

```js
npm install
npm run start:official-2017   // 2017 年县级以上区划代码
npm run start:official-2015   // 2015 年区划代码
npm run start:official-2013   // 2013 年区划代码
npm run start:official-update // 县级以下区划代码变更
npm run start:unofficial      // 博雅地名网区划代码
```

## VSCode 调试配置文件 launch.json

```json
{
  "version": "0.2.0",
  "configurations": [{
    "type": "node",
    "request": "launch",
    "name": "启动程序",
    "program": "${workspaceRoot\\division-code\\official\\index-2015.js"
  }]
}
```

## 初衷

  区划代码数据没有公信部门提供统一的标准与服务，数据比较散乱。

  比较淘宝和京东的区划代码数据，发现他们的数据也不是最新，他们维护着自己一套数据，不是以标准区划代码为 id 的数据，可能是由于区划代码的易变性不好维护吧，但这并不太影响他们物流的服务。

  目前区划数据淘宝也有售卖，价格几十块钱，不算贵。

  网上有人会提供一些数据，但发现有些数据不全或者偏差。就有了自己爬一套数据的想法，就找到了一些权威网站比如国家统计局，国家民政部，开始了首次爬数据之旅。

## 所用工具

    node 环境
    npm package:
    async         // 处理并发请求，回调
    cheerio       // node 版的 jQuery
    iconv-lite    // 请求返回的数据转码
    request       // 请求

## 疑惑1

async mapList 方法 10 个省份数据能成功回调，超过后就无法成功回调，很疑惑，望能帮助解答，见 [index-2015.js](official/index-2015.js)

```js
Promise.all(provinceArr.map(item => {
    const provinceName = item.name;
    const provinceUrl = item.url;
    return new Promise(resolve => {
      captureUrl(provinceUrl, resolve, provinceName);
    })
  }))
  .then(res => {
    let tempArr = [];
    res.map(item => {
      // 解析市一级数据
      tempArr = tempArr.concat(this.captureCity(item, item.href))
    });

    return new Promise(resolve => {
      async.mapLimit(tempArr, 10, function (item, callback) {
        let temp = [];
        captureUrl(item, function ($) {
          console.log(item);
          // 解析区县一级数据
          temp = temp.concat(parseHtml.captureCountry($));
          callback(null, temp);
        });
      }, function (err, result) {
        let tempArr = [];
        result.map(item => {
          tempArr = tempArr.concat(item);
        });
        resolve(tempArr);
      });
    });

  }).then(res => {
    return new Promise(resolve => {
      async.mapLimit(res, 10, function (item, callback) {
        let temp = [];
        captureUrl(item, function ($) {
          console.log(item);

          // 解析街道或者乡镇一级数据
          parseHtml.captureTown($);
          // 省份超过 10 个 callback 无效。找不到原因，不得已写法
          // fs.createWriteStream(__dirname + '/data/list-2015.json').write(JSON.stringify(listJSON));
          callback(null);
        });
      }, function (err, result) {
        console.log(err)
        resolve(true)
      });
    });
  }).then(res => {
    // 所有请求完成后 callback 
    console.log('区划信息写入成功~')
    writeJSON.write(JSON.stringify(listJSON));
  }).catch(err => {
    console.log(err)
  });
```

## 结论

1. 非官方的博雅网的数据相对较准确，并发请求过多时，网站返回异常页面，开始解决并发问题时，便转为爬官方网站数据，官方对并发没做处理，直接就服务器异常，尴尬脸

2. 2015 年的数据与 2013 年的总数据比对有 700+ 行变更，有觉得数据不对

3. 利用 2015 年以来新的变更数据去更新 2015 年的数据，页面表格左侧数据查询 2015 数据然后删掉，右侧变更后的数据添加到源数据，却发现表格中有的数据比较难以区分来实现数据归类

4. 官方[地名普查办](http://dmpc.mca.gov.cn/)正在进行第二次地名普查，确保 2017 年 6 月 30 号完成全国地名普查工作，并向社会提供地名服务，详见[如何切实做好第二次全国地名普查验收工作](http://www.mca.gov.cn/article/fw/zcjd/qhdm/201704/20170400004094.shtml)

5. 只是做一次尝试，目的已初步实现，暂时不浪费太多时间去抓取一些可能有问题的数据，待官方公布新的数据，看情况是否需要做一次完整的数据




