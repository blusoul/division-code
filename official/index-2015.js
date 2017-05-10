const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');
const async = require('async');
const _ = require('lodash');

const entryUrl = 'http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2015/index.html';
const writeJSON = fs.createWriteStream(__dirname + '/data/list-2015.json');

// 待写入的JSON数据
let listJSON = {};

function combineLink({
  originUrl,
  spliceUrl
}) {
  if (typeof originUrl == 'string' && /^http/.test(originUrl)) {
    const lastIndex = originUrl.lastIndexOf('/');
    return originUrl.substr(0, lastIndex + 1) + spliceUrl;
  }
}

const parseHtml = {
  captureProvince($) {
    const linkList = $('.provincetr a');
    let provinceArr = [];

    linkList.map((index, item) => {
      const $item = $(item);
      if (index < 3) {
        provinceArr.push({
          url: combineLink({
            originUrl: entryUrl,
            spliceUrl: $item.attr('href')
          }),
          name: $item.text().trim()
        });
      }

    });
    return provinceArr;
  },
  captureCity($) {
    const cityList = $('.citytr');
    let provinceCode = 0;
    let cityUrlArr = [];

    cityList.map((index, item) => {
      const linkNodes = $(item).find('td');
      const code = linkNodes.eq(0).text().trim();
      const name = linkNodes.eq(1).text().trim();
      const url = linkNodes.eq(0).find('a').attr('href');

      if (!provinceCode) {
        provinceCode = code.substr(0, 2) + '0000000000';
        listJSON[provinceCode] = $.provinceName;
      }

      listJSON[code] = name;
      cityUrlArr.push(combineLink({
        originUrl: $.href,
        spliceUrl: url
      }));

    });

    return cityUrlArr;
  },
  captureCountry($, cityUrl) {
    const cityList = $('.countytr');
    let areaUrlArr = [];

    cityList.map((index, item) => {
      const linkNodes = $(item).find('td');
      const code = linkNodes.eq(0).text().trim();
      const name = linkNodes.eq(1).text().trim();
      const url = linkNodes.eq(0).find('a').attr('href');

      listJSON[code] = name;
      if (url) {
        areaUrlArr.push(combineLink({
          originUrl: $.href,
          spliceUrl: url
        }));
      }
    });

    return areaUrlArr;
  },
  captureTown($) {
    const cityList = $('.towntr');

    cityList.map((index, item) => {
      const linkNodes = $(item).find('a');
      const code = linkNodes.eq(0).text().trim();
      const name = linkNodes.eq(1).text().trim();

      listJSON[code] = name;
    });
  },
  deal(res, entryUrl) {
    let i = 0;
    const provinceArr = this.captureProvince(res);

    Promise.all(provinceArr.map(item => {
        const provinceName = item.name;
        const provinceUrl = item.url;
        return new Promise((resolve, reject) => {
          captureUrl(provinceUrl, resolve, provinceName);
        })
      }))
      .then(res => {
        let tempArr = [];
        res.map(item => {
          tempArr = tempArr.concat(this.captureCity(item, item.href))
        });

        async.mapLimit(tempArr, 10, function (item, callback) {
          let temp = [];
          captureUrl(item, function ($) {
            console.log(item)
            temp = temp.concat(parseHtml.captureCountry($));
            callback(null, temp);
          });
        }, function (err, result) {
          let tempArr = [];
          result.map(item => {
            tempArr = tempArr.concat(item);
          });

          async.mapLimit(tempArr, 10, function (item, callback) {
            let temp = [];
            captureUrl(item, function ($) {
              console.log(item)
              temp = temp.concat(parseHtml.captureTown($));
              callback(null, temp);
            });
          }, function (err, result) {
            writeJSON.write(JSON.stringify(listJSON));
            console.log('区划信息写入成功~')
          });
        });
      });
  }
};

function captureUrl(url, fn, provinceName) {
  request.get({
    url: url,
    encoding: null //让body 直接是buffer
  }, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      const convertedHtml = iconv.decode(body, 'gb2312');
      const $ = cheerio.load(convertedHtml, {
        decodeEntities: false
      });
      $.href = url;
      $.provinceName = provinceName;
      fn($);
    }
    if (error) {
      console.log(url)
    }
  });
}

captureUrl(entryUrl, function (res) {
  parseHtml.deal(res, entryUrl);
});