// 测试合同审查API的脚本
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 测试合同审查功能
async function testContractReview() {
  try {
    console.log('开始测试合同审查功能...');
    
    // 创建一个测试用的DOCX文件路径（假设存在）
    const testFilePath = path.join(__dirname, 'test-contract.docx');
    
    // 检查测试文件是否存在
    if (!fs.existsSync(testFilePath)) {
      console.log('测试文件不存在，创建一个模拟的测试文件...');
      // 创建一个简单的测试文件内容
      const testContent = '这是一个测试合同文件，用于验证合同审查功能。';
      fs.writeFileSync(testFilePath, testContent);
    }
    
    // 创建FormData
    const formData = new FormData();
    formData.append('contract_file', fs.createReadStream(testFilePath));
    formData.append('analysis_position', '中立');
    
    console.log('发送合同审查请求...');
    
    // 发送请求
    const response = await axios.post('http://127.0.0.1:3000/api/contract-review/review', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      responseType: 'stream',
      timeout: 120000 // 2分钟超时
    });
    
    console.log('收到响应，开始处理流式数据...');
    
    // 处理流式响应
    let buffer = '';
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            console.log('收到数据:', data);
            
            if (data.step === 'analysis_complete') {
              console.log('=== 分析完成 ===');
              console.log('返回的数据结构:', JSON.stringify(data.data, null, 2));
              console.log('合同名称:', data.data.contract_name);
              console.log('合同类型:', data.data.contract_type);
              console.log('生效日期:', data.data.effective_date);
              console.log('终止日期:', data.data.termination_date);
              console.log('管辖权:', data.data.jurisdiction);
              console.log('涉及主体:', data.data.parties_involved);
              console.log('合同摘要:', data.data.contract_summary);
              console.log('风险条款:', data.data.risk_clauses);
              console.log('核心条款:', data.data.core_clauses);
            }
          } catch (e) {
            console.warn('解析响应数据失败:', e);
          }
        }
      }
    });
    
    response.data.on('end', () => {
      console.log('响应流结束');
    });
    
    response.data.on('error', (error) => {
      console.error('响应流错误:', error);
    });
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
if (require.main === module) {
  testContractReview();
}

module.exports = { testContractReview };

