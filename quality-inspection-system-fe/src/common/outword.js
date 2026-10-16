/**
 * 导出word文档（带图片）
 * 
 */
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import JSZipUtils from 'jszip-utils'
import { saveAs } from 'file-saver'
import ImageModule from 'docxtemplater-image-module-free'
import expressions from 'angular-expressions'
import assign from 'lodash/assign'
import last from 'lodash/last'
import axios from 'axios';

/**
 * 将base64格式的数据转为ArrayBuffer
 * @param {Object} dataURL base64格式的数据
 */
function base64DataURLToArrayBuffer(dataURL) {
    const base64Regex = /^data:image\/(png|jpg|jpeg|svg|svg\+xml);base64,/;
    if (!base64Regex.test(dataURL)) {
        return false;
    }
    const stringBase64 = dataURL.replace(base64Regex, "");
    let binaryString;
    if (typeof window !== "undefined") {
        binaryString = window.atob(stringBase64);
    } else {
        binaryString = Buffer.from(stringBase64, "base64").toString("binary");
    }
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        const ascii = binaryString.charCodeAt(i);
        bytes[i] = ascii;
    }
    return bytes.buffer;
}



// export const ExportBriefDataDocx = (tempDocxPath, data, fileName, imgSize) => {
//     // console.log(111, tempDocxPath, data, fileName, imgSize)
//     expressions.filters.lower = function (input) {
//         // This condition should be used to make sure that if your input is
//         // undefined, your output will be undefined as well and will not
//         // throw an error
//         if (!input) return input
//         // toLowerCase() 方法用于把字符串转换为小写。
//         return input.toLowerCase()
//     }
//     function angularParser(tag) {
//         tag = tag
//             .replace(/^\.$/, 'this')
//             .replace(/(’|‘)/g, "'")
//             .replace(/(“|”)/g, '"')
//         const expr = expressions.compile(tag)
//         return {
//             get: function (scope, context) {
//                 let obj = {}
//                 const index = last(context.scopePathItem)
//                 const scopeList = context.scopeList
//                 const num = context.num
//                 for (let i = 0, len = num + 1; i < len; i++) {
//                     obj = assign(obj, scopeList[i])
//                 }
//                 //word模板中使用 $index+1 创建递增序号
//                 obj = assign(obj, { $index: index })
//                 return expr(scope, obj)
//             }
//         }
//     }
//     JSZipUtils.getBinaryContent(tempDocxPath, (error, content) => {
//         if (error) {
//             console.log(error)
//         }
//         expressions.filters.size = function (input, width, height) {
//             return {
//                 data: input,
//                 size: [width, height],
//             };
//         };
//         let opts = {}
//         opts = {
//             //图像是否居中
//             centered: true
//         };
//         opts.getImage = (chartId) => {
//             //将base64的数据转为ArrayBuffer
//             return base64DataURLToArrayBuffer(chartId);
//         }
//         opts.getSize = function (img, tagValue, tagName) {
//             //自定义指定图像大小
//             if (tagName=='signature') {
//                 return [80,40];
//             } else {
//                 return imgSize;
//             }
//         }




//         // 创建一个JSZip实例，内容为模板的内容        
//         const zip = new PizZip(content)
//         // 创建并加载 Docxtemplater 实例对象
        
//         // 设置模板变量的值
        
// 		let doc = new Docxtemplater();
//         doc.attachModule(new ImageModule(opts));
//         doc.loadZip(zip);
//         doc.setOptions({parser:angularParser});
//         doc.setData(data)
//         try {
//             // 呈现文档，会将内部所有变量替换成值，
//             doc.render()
//         } catch (error) {
//             const e = {
//                 message: error.message,
//                 name: error.name,
//                 stack: error.stack,
//                 properties: error.properties

//             }
//             console.log('err',{ error: e })
//             // 当使用json记录时，此处抛出错误信息
//             throw error
//         }
//         // 生成一个代表Docxtemplater对象的zip文件（不是一个真实的文件，而是在内存中的表示）
//         const out = doc.getZip().generate({
//             type: 'blob',
//             mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
//         })
//         // 将目标文件对象保存为目标类型的文件，并命名
//         saveAs(out, fileName)
//     })
// }

// ExportBriefDataDocx
export const ExportBriefDataDocx = (tempDocxPath, data) => {
    const fixedFileName = '合同质检报告.docx';

    return axios.get(tempDocxPath, { responseType: 'arraybuffer' }) // 确保返回 Promise
        .then(response => {
            const content = response.data;
            const zip = new PizZip(content);
            const doc = new Docxtemplater();

            doc.loadZip(zip);
            doc.setData(data);
            doc.render();

            const out = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            // 保存并上传文件
            const formData = new FormData();
            formData.append('file', out, fixedFileName);
            return axios.post("/api/saveDocx", formData);
        })
        .then(response => {
            console.log("文件保存成功", response.data);
        })
        .catch(err => {
            console.error("处理过程中发生错误：", err);
            throw err; // 抛出错误以便上层捕获
        });
};

/**
 * 将图片的url路径转为base64路径
 * 可以用await等待Promise的异步返回
 * @param {Object} imgUrl 图片路径
 */
export function getBase64Sync(imgUrl) {
    return new Promise(function (resolve, reject) {
        // 一定要设置为let，不然图片不显示
        let image = new Image();
        //图片地址
        image.src = imgUrl;
        // 解决跨域问题
        image.setAttribute("crossOrigin", '*');  // 支持跨域图片
        // image.onload为异步加载
        image.onload = function () {
            let canvas = document.createElement("canvas");
            canvas.width = image.width; 
            canvas.height = image.height;
            let context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, image.width, image.height);
            //图片后缀名
            let ext = image.src.substring(image.src.lastIndexOf(".") + 1).toLowerCase();
            //图片质量
            let quality = 0.8;
            //转成base64
            let dataurl = canvas.toDataURL("image/" + ext, quality);
            //返回
            resolve(dataurl);
        };
    })
}