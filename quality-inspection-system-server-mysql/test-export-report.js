const axios = require('axios');

// 测试导出报告功能
async function testExportReport() {
  try {
    console.log('开始测试导出报告功能...');
    
    // 测试1: 缺少result_id参数
    console.log('\n1. 测试缺少result_id参数...');
    try {
      const response1 = await axios.post('http://127.0.0.1:3000/api/contract-review/export_review_report', {
        // 故意不传result_id
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ 应该失败但成功了:', response1.status);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ 正确返回400错误:', error.response.data.message);
      } else {
        console.log('❌ 意外的错误:', error.message);
      }
    }
    
    // 测试2: result_id为undefined
    console.log('\n2. 测试result_id为undefined...');
    try {
      const response2 = await axios.post('http://127.0.0.1:3000/api/contract-review/export_review_report', {
        result_id: undefined
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ 应该失败但成功了:', response2.status);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ 正确返回400错误:', error.response.data.message);
      } else {
        console.log('❌ 意外的错误:', error.message);
      }
    }
    
    // 测试3: result_id为无效数字
    console.log('\n3. 测试result_id为无效数字...');
    try {
      const response3 = await axios.post('http://127.0.0.1:3000/api/contract-review/export_review_report', {
        result_id: 'invalid'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ 应该失败但成功了:', response3.status);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ 正确返回400错误:', error.response.data.message);
      } else {
        console.log('❌ 意外的错误:', error.message);
      }
    }
    
    // 测试4: result_id为负数
    console.log('\n4. 测试result_id为负数...');
    try {
      const response4 = await axios.post('http://127.0.0.1:3000/api/contract-review/export_review_report', {
        result_id: -1
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ 应该失败但成功了:', response4.status);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ 正确返回400错误:', error.response.data.message);
      } else {
        console.log('❌ 意外的错误:', error.message);
      }
    }
    
    // 测试5: result_id为0
    console.log('\n5. 测试result_id为0...');
    try {
      const response5 = await axios.post('http://127.0.0.1:3000/api/contract-review/export_review_report', {
        result_id: 0
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ 应该失败但成功了:', response5.status);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ 正确返回400错误:', error.response.data.message);
      } else {
        console.log('❌ 意外的错误:', error.message);
      }
    }
    
    // 测试6: result_id为不存在的ID
    console.log('\n6. 测试result_id为不存在的ID...');
    try {
      const response6 = await axios.post('http://127.0.0.1:3000/api/contract-review/export_review_report', {
        result_id: 99999
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ 应该失败但成功了:', response6.status);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ 正确返回404错误:', error.response.data.message);
      } else {
        console.log('❌ 意外的错误:', error.message);
      }
    }
    
    // 测试7: 正确的result_id（如果数据库中有数据）
    console.log('\n7. 测试正确的result_id...');
    try {
      const response7 = await axios.post('http://127.0.0.1:3000/api/contract-review/export_review_report', {
        result_id: 1
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response7.status === 200) {
        console.log('✅ 成功导出报告，内容长度:', response7.data.length);
        console.log('报告内容预览:', response7.data.substring(0, 200) + '...');
      } else {
        console.log('❌ 意外的响应状态:', response7.status);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ 正确返回404错误（ID=1的记录不存在）:', error.response.data.message);
      } else {
        console.log('❌ 意外的错误:', error.message);
      }
    }
    
    console.log('\n🎉 导出报告功能测试完成！');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testExportReport();
}

module.exports = { testExportReport };
