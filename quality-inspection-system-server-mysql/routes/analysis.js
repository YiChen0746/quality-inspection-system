const express = require('express');
const { QualityResult, Contract } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const moment = require('moment');

const router = express.Router();

// 按类型分析数据
const analysisByType = async (req, res) => {
  try {
    const { type, hospital, startTime, endTime } = req.body;
    
    if (!type) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少分析类型参数'
      });
    }

    // 获取用户ID（如果有）
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // 构建查询条件
    const where = {};
    if (userId) {
      where.user_id = userId;
    }

    if (hospital && hospital !== '全部') {
      where.hospital = hospital;
    }

    if (startTime && endTime) {
      where.createdAt = {
        [Op.between]: [new Date(startTime), new Date(endTime)]
      };
    } else if (startTime) {
      where.createdAt = {
        [Op.gte]: new Date(startTime)
      };
    } else if (endTime) {
      where.createdAt = {
        [Op.lte]: new Date(endTime)
      };
    }

    let result;

    // 根据不同的分析类型执行不同的查询
    switch (type) {
      case 'contract_type':
        // 按合同类型统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            'contract_type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['contract_type'],
          order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          name: item.contract_type || '未知类型',
          value: parseInt(item.dataValues.count)
        }));
        break;

      case 'hospital':
        // 按医院统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            'hospital',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['hospital'],
          order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          name: item.hospital || '未知医院',
          value: parseInt(item.dataValues.count)
        }));
        break;

      case 'time_trend':
        // 按时间趋势统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d'), 'date'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d')],
          order: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d')]
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          date: item.dataValues.date,
          count: parseInt(item.dataValues.count)
        }));
        break;

      case 'risk_count':
        // 按风险条款数量统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            'id',
            'contract_name',
            [
              sequelize.literal(`(
                LENGTH(risk_clauses) - LENGTH(REPLACE(risk_clauses, '条款名称', ''))
              ) / LENGTH('条款名称')`),
              'risk_count'
            ]
          ],
          order: [[sequelize.literal('risk_count'), 'DESC']],
          limit: 10
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          contract_name: item.contract_name || `合同ID: ${item.id}`,
          risk_count: parseInt(item.dataValues.risk_count) || 0
        }));
        break;

      default:
        return res.status(400).json({
          err_code: 400,
          message: '不支持的分析类型'
        });
    }

    return res.status(200).json({
      err_code: 0,
      message: '分析成功',
      data: result
    });
  } catch (error) {
    console.error('数据分析失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 获取合同统计数据
const getContractStatistics = async (req, res) => {
  try {
    const { days = 30 } = req.query; // 默认获取30天的数据
    
    // 计算开始日期
    const startDate = moment().subtract(days, 'days').startOf('day');
    const endDate = moment().endOf('day');
    
    console.log('查询时间范围:', startDate.format('YYYY-MM-DD'), '到', endDate.format('YYYY-MM-DD'));
    
    let reviewData = [];
    let draftData = [];
    let totalReview = 0;
    let totalDraft = 0;
    let todayReview = 0;
    let todayDraft = 0;
    
    try {
      // 检查表是否存在
      const tables = await sequelize.query('SHOW TABLES', { type: sequelize.QueryTypes.SHOWTABLES });
      
      // 获取合同审查数据
      if (tables.includes('quality_results')) {
        try {
          reviewData = await sequelize.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM quality_results 
            WHERE created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
          `, {
            replacements: [startDate.toDate(), endDate.toDate()],
            type: sequelize.QueryTypes.SELECT
          });
          
          totalReview = await QualityResult.count({
            where: {
              created_at: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
              }
            }
          });
          
          const todayStart = moment().startOf('day');
          const todayEnd = moment().endOf('day');
          
          todayReview = await QualityResult.count({
            where: {
              created_at: {
                [Op.between]: [todayStart.toDate(), todayEnd.toDate()]
              }
            }
          });
        } catch (error) {
          console.log('查询quality_results表失败:', error.message);
        }
      } else {
        console.log('quality_results表不存在');
      }
      
      // 获取合同起草数据
      if (tables.includes('contracts')) {
        try {
 // 首先检查contracts表是否有type字段
          // const columns = await sequelize.query(`
          //   SHOW COLUMNS FROM contracts LIKE 'type'
          // `, { type: sequelize.QueryTypes.SELECT });
          
          // let typeCondition = "";
          // if (columns.length > 0) {
          //   // 如果存在type字段，只统计类型为'draft'的记录
          //   typeCondition = "AND type = 'draft'";
          // }

          draftData = await sequelize.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM contracts 
            WHERE created_at BETWEEN ? AND ? 
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
          `, {
            replacements: [startDate.toDate(), endDate.toDate()],
            type: sequelize.QueryTypes.SELECT
          });
          
// 统计总数
          // let draftWhereCondition = {
          //   created_at: {
          //     [Op.between]: [startDate.toDate(), endDate.toDate()]
          //   }
          // };
          
          // if (columns.length > 0) {
          //   // 如果存在type字段，只统计类型为'draft'的记录
          //   draftWhereCondition.type = 'draft';
          // }
          

          totalDraft = await Contract.count({
            where:  
            // draftWhereCondition
            {
              created_at: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
              }
            }
          });
          
          const todayStart = moment().startOf('day');
          const todayEnd = moment().endOf('day');
          
//  let todayDraftCondition = {
//             created_at: {
//               [Op.between]: [todayStart.toDate(), todayEnd.toDate()]
//             }
//           };
          
//           if (columns.length > 0) {
//             // 如果存在type字段，只统计类型为'draft'的记录
//             todayDraftCondition.type = 'draft';
//           }
          

          todayDraft = await Contract.count({
            where: 
            // todayDraftCondition
            {
              created_at: {
                [Op.between]: [todayStart.toDate(), todayEnd.toDate()]
              }
            }
          });
        } catch (error) {
          console.log('查询contracts表失败:', error.message);
        }
      } else {
        console.log('contracts表不存在');
      }
      
    } catch (error) {
      console.log('检查表失败:', error.message);
    }

    console.log('查询结果:', {
      reviewData: reviewData.length,
      draftData: draftData.length,
      totalReview,
      totalDraft,
      todayReview,
      todayDraft
    });

    // 生成完整的日期范围数据
    const dateRange = [];
    const currentDate = moment(startDate);
    
    while (currentDate.isSameOrBefore(endDate)) {
      dateRange.push(currentDate.format('YYYY-MM-DD'));
      currentDate.add(1, 'day');
    }

    // 处理审查数据，填充缺失的日期
    const processedReviewData = dateRange.map(date => {
      const found = reviewData.find(item => item.date === date);
      return {
        date,
        count: found ? parseInt(found.count) : 0
      };
    });

    // 处理起草数据，填充缺失的日期
    const processedDraftData = dateRange.map(date => {
      const found = draftData.find(item => item.date === date);
      return {
        date,
        count: found ? parseInt(found.count) : 0
      };
    });

    res.json({
      err_code: 0,
      message: '获取成功',
      data: {
        summary: {
          totalReview,
          totalDraft,
          todayReview,
          todayDraft
        },
        reviewData: processedReviewData,
        draftData: processedDraftData,
        dateRange
      }
    });

  } catch (error) {
    console.error('获取合同统计数据失败:', error);
    res.status(500).json({
      err_code: 500,
      message: '服务器错误: ' + error.message
    });
  }
};

module.exports = {
  router,
  analysisByType,
  getContractStatistics
}; 