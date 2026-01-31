const gridEl = document.getElementById('grid');
        const ruleText = document.getElementById('ruleText');
        const modal = document.getElementById('modal');
        const fileInput = document.getElementById('fileInput');
        
        const GRID_SIZE = 9;
        let gridData = [];
        let currentTarget = 3;
        let cellTypes = [];
        let pathLines = [];
        
        // ===== 坐标填充系统 =====
        let gridContentKeys = [];
        let gridImageKeys = [];
        let usageCount = {};
        
        // 历史记录相关变量
        let historyRecords = [];
        let currentHistoryIndex = -1;
        const MAX_HISTORY = 20;
        
        // ========== 配置区域 ==========
        
        function generateImageList(count, extension = 'jpg') {
            const images = [];
            for (let i = 1; i <= count; i++) {
                images.push(`${i}.${extension}`);
            }
            return images;
        }
        
        // ========== 权重配置系统 ==========
        
        // 权重配置对象（默认值，会被 JSON 文件覆盖）
        let weightsConfig = {
            outer: {},
            inner: {}
        };
        
        // 加载权重配置文件
        async function loadWeightsConfig() {
            try {
                const response = await fetch('weights_config.json');
                if (response.ok) {
                    const config = await response.json();
                    
                    // 解析 outer 权重
                    if (config.outer && config.outer.items) {
                        for (const [imgName, data] of Object.entries(config.outer.items)) {
                            weightsConfig.outer[imgName] = data.weight || 1;
                        }
                    }
                    
                    // 解析 inner 权重
                    if (config.inner && config.inner.items) {
                        for (const [imgName, data] of Object.entries(config.inner.items)) {
                            weightsConfig.inner[imgName] = data.weight || 1;
                        }
                    }
                    
                    console.log('权重配置加载成功:', weightsConfig);
                } else {
                    console.warn('权重配置文件不存在，使用默认权重');
                }
            } catch (error) {
                console.warn('加载权重配置失败，使用默认权重:', error);
            }
        }
        
        // 获取图片权重
        function getImageWeight(imgName, type) {
            if (type === 'outer') {
                return weightsConfig.outer[imgName] || 1;
            } else if (type === 'inner') {
                return weightsConfig.inner[imgName] || 1;
            }
            return 1;
        }
        
        // 根据权重随机选择图片（加权随机）
        function weightedShuffle(images, type) {
            // 创建加权列表
            const weightedList = [];
            for (const imgName of images) {
                const weight = getImageWeight(imgName, type);
                // 权重为0的图片不加入列表
                if (weight > 0) {
                    // 根据权重添加多次（权重越高，出现概率越大）
                    for (let i = 0; i < weight; i++) {
                        weightedList.push(imgName);
                    }
                }
            }
            
            // 随机打乱加权列表
            const shuffled = weightedList.sort(() => Math.random() - 0.5);
            
            // 去重并保持顺序（第一次出现的位置决定优先级）
            const seen = new Set();
            const result = [];
            for (const imgName of shuffled) {
                if (!seen.has(imgName)) {
                    seen.add(imgName);
                    result.push(imgName);
                }
            }
            
            return result;
        }
        
        // ========== 权重配置系统结束 ==========
        
        // 1. 外围区域配置
        const outerConfig = {
            folder: 'images1/outer/',
            imageCount: 27,
            extension: 'jpg',
            maxUsage: 3
        };
        outerConfig.images = generateImageList(outerConfig.imageCount, outerConfig.extension);
        
        // 2. 第一条7格路线配置 - 每张图片只使用1次
        const path1Config = {
            folder: 'images1/path1/',
            imageCount: 7,
            extension: 'jpg'
        };
        path1Config.fixedImages = generateImageList(path1Config.imageCount, path1Config.extension);
        
        // 3. 第二条7格路线配置 - 每张图片只使用1次
        const path2Config = {
            folder: 'images1/path2/',
            imageCount: 7,
            extension: 'jpg'
        };
        path2Config.fixedImages = generateImageList(path2Config.imageCount, path2Config.extension);
        
        // 4. 内部区域配置
        const innerConfig = {
            folder: 'images1/inner/',
            imageCount: 28,
            extension: 'jpg',
            maxUsage: 3
        };
        innerConfig.images = generateImageList(innerConfig.imageCount, innerConfig.extension);
        
        // 5. 路线交叉概率配置
        const pathConfigSettings = {
            crossProbability: 0.4,
            minCrossCells: 1,
            maxCrossCells: 3
        };
        
        // 6. 图片内容映射表（相同内容的图片映射到同一个contentKey）
        const imageContentMap = {
      // 组A: path1/1 = path2/1 = inner/1
            'images1/path1/1.jpg': 'content_A',
            'images1/path2/1.jpg': 'content_A',
            'images1/inner/1.jpg': 'content_A',
            
            // 组B: path1/2 = inner/8
            'images1/path1/2.jpg': 'content_B',
            'images1/inner/7.jpg': 'content_B',
            
            // 组C: path1/3 = inner/3
            'images1/path1/3.jpg': 'content_C',
            'images1/inner/3.jpg': 'content_C',
            
            // 组D: path1/4 = inner/26
            'images1/path1/4.jpg': 'content_D',
            'images1/inner/25.jpg': 'content_D',
            
            // 组E: path1/5 = inner/27
            'images1/path1/5.jpg': 'content_E',
            'images1/inner/26.jpg': 'content_E',
            
            // 组F: path1/6 = inner/6
            'images1/path1/6.jpg': 'content_F',
            'images1/inner/6.jpg': 'content_F',
            
            // 组G: path1/7 = path2/7
            'images1/path1/7.jpg': 'content_G',
            'images1/path2/7.jpg': 'content_G',
            
            // 组H: path2/2 = inner/2 
            'images1/path2/2.jpg': 'content_H',
            'images1/inner/2.jpg': 'content_H',
        
            // 组I: path2/3 = inner/24
            'images1/path2/3.jpg': 'content_I',
            'images1/inner/23.jpg': 'content_I',
            
            // 组J: path2/4 = inner/4
            'images1/path2/4.jpg': 'content_J',
            'images1/inner/4.jpg': 'content_J',
            
            // 组K: path2/5 = inner/5
            'images1/path2/5.jpg': 'content_K',
            'images1/inner/5.jpg': 'content_K',

            // 组L: path2/6 = inner/20
            'images1/path2/6.jpg': 'content_L',
            'images1/inner/20.jpg': 'content_L'
        };
        
        function getContentKey(imageKey) {
            return imageContentMap[imageKey] || imageKey;
        }
        
        // 7. 图片使用次数限制配置
        // 基于 contentKey 或 imageKey 设置最大使用次数
        const maxUsageLimits = {
            // inner/1 和 inner/2 只能使用1次
            'images1/inner/1.jpg': 1,
            'images1/inner/2.jpg': 2,
            'content_A': 3,  // inner/1 对应的 contentKey
            'content_H': 3,  // inner/2 对应的 contentKey
            
            // inner/3,4,5,6,7,23,25,26 最多使用2次
            'images1/inner/3.jpg': 2,
            'images1/inner/4.jpg': 2,
            'images1/inner/5.jpg': 2,
            'images1/inner/6.jpg': 2,
            'images1/inner/7.jpg': 1,
            'images1/inner/23.jpg': 2,
            'images1/inner/25.jpg': 1,
            'images1/inner/26.jpg': 2,
            'content_C': 2,  // inner/3 对应的 contentKey
            'content_J': 2,  // inner/4 对应的 contentKey
            'content_K': 2,  // inner/5 对应的 contentKey
            'content_F': 2,  // inner/6 对应的 contentKey
            'content_D': 2   // inner/26 对应的 contentKey
        };
        
        // 获取指定 contentKey 或 imageKey 的最大使用次数
        function getMaxUsage(key) {
            return maxUsageLimits[key] !== undefined ? maxUsageLimits[key] : 3;
        }
        
        // ========== 配置区域结束 ==========
        
        // ========== 核心修改：内外区域区分逻辑 ==========
        
        // 判断是否为内部7×7区域
        function isInner7x7(row, col) {
            return row >= 1 && row <= 7 && col >= 1 && col <= 7;
        }
        
        // 邻8格检查函数（只用于内部区域）- 使用contentKey检查
        function checkAdjacent8(row, col, contentKey) {
            // 检查周围的8个方向
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],  // 左上、上、右上
                [0, -1],           [0, 1],   // 左、右
                [1, -1],  [1, 0],  [1, 1]    // 左下、下、右下
            ];
            
            for (const [dr, dc] of directions) {
                const nr = row + dr;
                const nc = col + dc;
                
                // 检查边界
                if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                    // 使用contentKey进行比较
                    if (gridContentKeys[nr] && gridContentKeys[nr][nc] === contentKey) {
                        return false; // 邻格有相同contentKey的图片
                    }
                }
            }
            
            return true; // 所有邻格都没有相同contentKey
        }
        
        // 行、列、对角线检查函数（只用于外部区域）
        function checkRowColDiagonal(row, col, contentKey) {
            // 检查同行不重复
            for (let c = 0; c < GRID_SIZE; c++) {
                if (c !== col && gridContentKeys[row][c] === contentKey) {
                    return false;
                }
            }
            
            // 检查同列不重复
            for (let r = 0; r < GRID_SIZE; r++) {
                if (r !== row && gridContentKeys[r][col] === contentKey) {
                    return false;
                }
            }
            
            // 检查主对角线不重复 (row === col)
            if (row === col) {
                for (let i = 0; i < GRID_SIZE; i++) {
                    if (i !== row && gridContentKeys[i][i] === contentKey) {
                        return false;
                    }
                }
            }
            
            // 检查副对角线不重复 (row + col === 8)
            if (row + col === GRID_SIZE - 1) {
                for (let i = 0; i < GRID_SIZE; i++) {
                    if (i !== row && gridContentKeys[i][GRID_SIZE - 1 - i] === contentKey) {
                        return false;
                    }
                }
            }
            
            return true;
        }
        
        // ========== 坐标填充系统核心逻辑 ==========
        
        function initImageSystem() {
            gridContentKeys = [];
            gridImageKeys = [];
            usageCount = {};
            
            for (let r = 0; r < GRID_SIZE; r++) {
                gridContentKeys[r] = [];
                gridImageKeys[r] = [];
                for (let c = 0; c < GRID_SIZE; c++) {
                    gridContentKeys[r][c] = null;
                    gridImageKeys[r][c] = null;
                }
            }
        }
        
        // 检查是否可以在指定坐标(row, col)放置图片
        function canPlaceImageAtCoord(row, col, contentKey) {
            // ========== 区分内外区域 ==========
            if (isInner7x7(row, col)) {
                // 内部7×7区域：只检查邻8格（基于contentKey）
                return checkAdjacent8(row, col, contentKey);
            } else {
                // 外部区域：保持原有的行、列、对角线检查（基于contentKey）
                return checkRowColDiagonal(row, col, contentKey);
            }
        }
        
        // 检查contentKey的总使用次数是否超过限制
        function canUseContentKey(contentKey, maxUsage = 3) {
            const limit = getMaxUsage(contentKey);
            // 取配置限制和传入限制的较小值
            const effectiveLimit = Math.min(limit, maxUsage);
            return (usageCount[contentKey] || 0) < effectiveLimit;
        }
        
        // 在指定坐标放置图片
        function placeImageAtCoord(row, col, imageKey) {
            const contentKey = getContentKey(imageKey);
            gridContentKeys[row][col] = contentKey;
            gridImageKeys[row][col] = imageKey;
            usageCount[contentKey] = (usageCount[contentKey] || 0) + 1;
            console.log(`✓ 坐标(${row},${col})放置: ${imageKey} (contentKey: ${contentKey}, 总使用: ${usageCount[contentKey]})`);
            return imageKey;
        }
        
        // 为路径分配图片（每张图片只使用1次，随机分布）- 修复强制放置逻辑
        function assignPathImages(pathCells, pathConfig, pathName) {
            console.log(`--- 为${pathName}分配图片 (${pathCells.length}个格子, ${pathConfig.fixedImages.length}张图片) ---`);
            
            // 随机打乱格子顺序
            const shuffledCells = [...pathCells].sort(() => Math.random() - 0.5);
            // 随机打乱图片顺序
            const shuffledImages = [...pathConfig.fixedImages].sort(() => Math.random() - 0.5);
            
            // 用于跟踪已使用的图片索引
            const usedImageIndices = new Set();
            
            // 为每个格子分配图片
            for (let cellIdx = 0; cellIdx < shuffledCells.length; cellIdx++) {
                const { row, col } = shuffledCells[cellIdx];
                let assigned = false;
                
                // 尝试找到一个可以放置的图片
                for (let imgIdx = 0; imgIdx < shuffledImages.length; imgIdx++) {
                    if (usedImageIndices.has(imgIdx)) continue;
                    
                    const imgName = shuffledImages[imgIdx];
                    const imageKey = pathConfig.folder + imgName;
                    const contentKey = getContentKey(imageKey);
                    
                    // 检查是否可以在此坐标放置
                    if (canPlaceImageAtCoord(row, col, contentKey) && canUseContentKey(contentKey, 3)) {
                        placeImageAtCoord(row, col, imageKey);
                        usedImageIndices.add(imgIdx);
                        assigned = true;
                        break;
                    }
                }
                
                // 如果没有找到合适的图片，强制使用第一个未使用的图片（但必须通过邻格检查）
                if (!assigned) {
                    for (let imgIdx = 0; imgIdx < shuffledImages.length; imgIdx++) {
                        if (usedImageIndices.has(imgIdx)) continue;
                        
                        const imgName = shuffledImages[imgIdx];
                        const imageKey = pathConfig.folder + imgName;
                        const contentKey = getContentKey(imageKey);
                        
                        // 强制放置前仍然检查邻格条件
                        if (canPlaceImageAtCoord(row, col, contentKey) && canUseContentKey(contentKey, 3)) {
                            console.warn(`${pathName}格子(${row},${col})强制使用: ${imageKey}`);
                            placeImageAtCoord(row, col, imageKey);
                            usedImageIndices.add(imgIdx);
                            assigned = true;
                            break;
                        }
                    }
                }
                
                // 如果所有图片都用完了，使用inner图片替代（但必须通过邻格检查）
                if (!assigned) {
                    const innerImages = [...innerConfig.images].sort(() => Math.random() - 0.5);
                    for (const imgName of innerImages) {
                        const imageKey = innerConfig.folder + imgName;
                        const contentKey = getContentKey(imageKey);
                        
                        if (canPlaceImageAtCoord(row, col, contentKey) && canUseContentKey(contentKey, 3)) {
                            console.warn(`${pathName}格子(${row},${col})使用inner图片替代: ${imageKey}`);
                            placeImageAtCoord(row, col, imageKey);
                            assigned = true;
                            break;
                        }
                    }
                }
                
                // 如果仍然没有找到合适的图片，放宽使用次数限制（但邻格条件必须满足）
                if (!assigned) {
                    const innerImages = [...innerConfig.images].sort(() => Math.random() - 0.5);
                    for (const imgName of innerImages) {
                        const imageKey = innerConfig.folder + imgName;
                        const contentKey = getContentKey(imageKey);
                        
                        if (canPlaceImageAtCoord(row, col, contentKey)) {
                            console.warn(`${pathName}格子(${row},${col})放宽使用次数限制: ${imageKey}`);
                            placeImageAtCoord(row, col, imageKey);
                            assigned = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // 为inner格子选择图片（使用权重随机）
        function selectImageForInnerCell(row, col) {
            const images = innerConfig.images;
            // 使用加权随机排序
            const shuffled = weightedShuffle(images, 'inner');
            
            for (const imgName of shuffled) {
                const imageKey = innerConfig.folder + imgName;
                const contentKey = getContentKey(imageKey);
                
                if (canPlaceImageAtCoord(row, col, contentKey) && canUseContentKey(contentKey, 3)) {
                    return placeImageAtCoord(row, col, imageKey);
                }
            }
            
            // 如果找不到合适的，放宽使用次数限制（但邻格条件必须满足）
            for (const imgName of shuffled) {
                const imageKey = innerConfig.folder + imgName;
                const contentKey = getContentKey(imageKey);
                
                if (canPlaceImageAtCoord(row, col, contentKey)) {
                    console.warn(`inner格子(${row},${col})放宽使用次数限制: ${imageKey}`);
                    return placeImageAtCoord(row, col, imageKey);
                }
            }
            
            const defaultImageKey = innerConfig.folder + shuffled[0];
            console.error(`inner格子(${row},${col})无法找到合适图片，使用默认: ${defaultImageKey}`);
            return placeImageAtCoord(row, col, defaultImageKey);
        }
        
        // 为outer格子选择图片（使用权重随机）
        function selectImageForOuterCell(row, col) {
            const images = outerConfig.images;
            // 使用加权随机排序
            const shuffled = weightedShuffle(images, 'outer');
            
            for (const imgName of shuffled) {
                const imageKey = outerConfig.folder + imgName;
                const contentKey = getContentKey(imageKey);
                
                if (canPlaceImageAtCoord(row, col, contentKey) && canUseContentKey(contentKey, 3)) {
                    return placeImageAtCoord(row, col, imageKey);
                }
            }
            
            // 如果找不到合适的，放宽使用次数限制
            for (const imgName of shuffled) {
                const imageKey = outerConfig.folder + imgName;
                const contentKey = getContentKey(imageKey);
                
                if (canPlaceImageAtCoord(row, col, contentKey)) {
                    console.warn(`outer格子(${row},${col})放宽使用次数限制: ${imageKey}`);
                    return placeImageAtCoord(row, col, imageKey);
                }
            }
            
            const defaultImageKey = outerConfig.folder + shuffled[0];
            console.error(`outer格子(${row},${col})无法找到合适图片，使用默认: ${defaultImageKey}`);
            return placeImageAtCoord(row, col, defaultImageKey);
        }
        
        // 核心填充函数：按优先级填充
        function fillGridImagesByCoord() {
            console.log('========== 开始坐标填充 ==========');
            initImageSystem();
            
            // 收集所有格子并按优先级分组
            const path1Cells = [];
            const path2Cells = [];
            const crossCells = [];
            const innerCells = [];
            const outerCells = [];
            
            for (let row = 0; row < GRID_SIZE; row++) {
                for (let col = 0; col < GRID_SIZE; col++) {
                    const type = cellTypes[row][col];
                    const coord = { row, col };
                    
                    if (type === 'path1') {
                        path1Cells.push(coord);
                    } else if (type === 'path2') {
                        path2Cells.push(coord);
                    } else if (type === 'cross') {
                        crossCells.push(coord);
                    } else if (type === 'outer') {
                        outerCells.push(coord);
                    } else {
                        innerCells.push(coord);
                    }
                }
            }
            
            console.log(`格子分布: path1=${path1Cells.length}, path2=${path2Cells.length}, cross=${crossCells.length}, inner=${innerCells.length}, outer=${outerCells.length}`);
            
            // 第一优先级：为path1分配图片（7张图片各使用1次，随机分布）
            // 注意：交叉点算作path1的一部分
            const allPath1Cells = [...path1Cells, ...crossCells];
            assignPathImages(allPath1Cells, path1Config, 'path1');
            
            // 第二优先级：为path2分配图片（7张图片各使用1次，随机分布）
            assignPathImages(path2Cells, path2Config, 'path2');
            
            // 第三优先级：填充outer格子
            console.log('--- 填充outer区域 ---');
            for (const { row, col } of outerCells) {
                selectImageForOuterCell(row, col);
            }
            
            // 第四优先级：填充inner格子
            console.log('--- 填充inner区域 ---');
            for (const { row, col } of innerCells) {
                selectImageForInnerCell(row, col);
            }
            
            // 验证网格
            validateGridAfterFill();
            
            console.log('========== 坐标填充完成 ==========');
            return gridImageKeys;
        }
        
        // 填充后验证网格
        function validateGridAfterFill() {
            let hasError = false;
            
            console.log('--- 开始验证网格 ---');
            
            // 按区域分别验证
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const currentContentKey = gridContentKeys[r][c];
                    if (!currentContentKey) continue;
                    
                    if (isInner7x7(r, c)) {
                        // 内部区域：验证邻8格（基于contentKey）
                        const directions = [
                            [-1, -1], [-1, 0], [-1, 1],
                            [0, -1],           [0, 1],
                            [1, -1],  [1, 0],  [1, 1]
                        ];
                        
                        for (const [dr, dc] of directions) {
                            const nr = r + dr;
                            const nc = c + dc;
                            
                            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                                if (gridContentKeys[nr][nc] === currentContentKey) {
                                    console.error(`❌ 内部区域邻格重复: (${r},${c}) 和 (${nr},${nc}) 都有 ${currentContentKey}`);
                                    hasError = true;
                                }
                            }
                        }
                    } else {
                        // 外部区域：验证行、列、对角线（基于contentKey）
                        // 验证行
                        for (let checkC = 0; checkC < GRID_SIZE; checkC++) {
                            if (checkC !== c && gridContentKeys[r][checkC] === currentContentKey) {
                                console.error(`❌ 外部区域行重复: (${r},${c}) 和 (${r},${checkC}) 都有 ${currentContentKey}`);
                                hasError = true;
                            }
                        }
                        
                        // 验证列
                        for (let checkR = 0; checkR < GRID_SIZE; checkR++) {
                            if (checkR !== r && gridContentKeys[checkR][c] === currentContentKey) {
                                console.error(`❌ 外部区域列重复: (${r},${c}) 和 (${checkR},${c}) 都有 ${currentContentKey}`);
                                hasError = true;
                            }
                        }
                        
                        // 验证主对角线
                        if (r === c) {
                            for (let i = 0; i < GRID_SIZE; i++) {
                                if (i !== r && gridContentKeys[i][i] === currentContentKey) {
                                    console.error(`❌ 外部区域主对角线重复: (${r},${c}) 和 (${i},${i}) 都有 ${currentContentKey}`);
                                    hasError = true;
                                }
                            }
                        }
                        
                        // 验证副对角线
                        if (r + c === GRID_SIZE - 1) {
                            for (let i = 0; i < GRID_SIZE; i++) {
                                if (i !== r && gridContentKeys[i][GRID_SIZE - 1 - i] === currentContentKey) {
                                    console.error(`❌ 外部区域副对角线重复: (${r},${c}) 和 (${i},${GRID_SIZE-1-i}) 都有 ${currentContentKey}`);
                                    hasError = true;
                                }
                            }
                        }
                    }
                }
            }
            
            // 检查使用次数（所有图片不超过3次）
            for (const [ck, count] of Object.entries(usageCount)) {
                if (count > 3) {
                    console.error(`❌ 图片${ck}使用了${count}次，超过3次限制`);
                    hasError = true;
                }
            }
            
            if (!hasError) {
                console.log('✅ 网格验证通过！');
            }
            
            // 输出使用统计
            console.log('--- 图片使用统计 ---');
            const sortedUsage = Object.entries(usageCount).sort((a, b) => b[1] - a[1]);
            for (const [ck, count] of sortedUsage) {
                if (count > 1) {
                    console.log(`  ${ck}: ${count}次`);
                }
            }
            
            return !hasError;
        }
        
        // ========== 路线生成函数 ==========
        
        function markOuterCells() {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (r === 0 || r === GRID_SIZE - 1 || c === 0 || c === GRID_SIZE - 1) {
                        cellTypes[r][c] = 'outer';
                    }
                }
            }
        }
        
        function generateRandomLine() {
            const direction = Math.floor(Math.random() * 4);
            let startRow, startCol;
            
            switch(direction) {
                case 0:
                    startRow = 1 + Math.floor(Math.random() * 7);
                    startCol = 1 + Math.floor(Math.random() * 3);
                    break;
                case 1:
                    startRow = 1 + Math.floor(Math.random() * 3);
                    startCol = 1 + Math.floor(Math.random() * 7);
                    break;
                case 2:
                    startRow = 1 + Math.floor(Math.random() * 3);
                    startCol = startRow;
                    break;
                case 3:
                    startRow = 1 + Math.floor(Math.random() * 3);
                    startCol = 9 - startRow - 6;
                    if (startCol < 1) startCol = 1;
                    break;
            }
            
            const line = [];
            const dr = [0, 1, 1, 1][direction];
            const dc = [1, 0, 1, -1][direction];
            
            for (let i = 0; i < 7; i++) {
                const row = startRow + dr * i;
                const col = startCol + dc * i;
                if (row >= 1 && row <= 7 && col >= 1 && col <= 7) {
                    line.push({ row, col });
                }
            }
            
            if (line.length < 7) {
                return generateRandomLine();
            }
            
            return line;
        }
        
        function linesOverlap(line1, line2) {
            const set = new Set();
            for (const cell of line1) {
                set.add(`${cell.row},${cell.col}`);
            }
            for (const cell of line2) {
                if (set.has(`${cell.row},${cell.col}`)) {
                    return true;
                }
            }
            return false;
        }
        
        function getCrossPoints(line1, line2) {
            const set = new Set();
            const crossPoints = [];
            
            for (const cell of line1) {
                set.add(`${cell.row},${cell.col}`);
            }
            
            for (const cell of line2) {
                if (set.has(`${cell.row},${cell.col}`)) {
                    crossPoints.push({ row: cell.row, col: cell.col });
                }
            }
            
            return crossPoints;
        }
        
        function generateVerticalLine() {
            const startRow = 1;
            const startCol = 1 + Math.floor(Math.random() * 7);
            const line = [];
            for (let i = 0; i < 7; i++) {
                line.push({ row: startRow + i, col: startCol });
            }
            return line;
        }
        
        function generateHorizontalLine() {
            const startRow = 1 + Math.floor(Math.random() * 7);
            const startCol = 1;
            const line = [];
            for (let i = 0; i < 7; i++) {
                line.push({ row: startRow, col: startCol + i });
            }
            return line;
        }
        
        function generateCrossingPathLines() {
            let line1 = generateRandomLine();
            let line2, crossPoints;
            let attempts = 0;
            
            const shouldCross = Math.random() < pathConfigSettings.crossProbability;
            
            if (!shouldCross) {
                do {
                    line2 = generateRandomLine();
                    attempts++;
                    if (attempts > 50) {
                        line2 = generateVerticalLine();
                        if (linesOverlap(line1, line2)) {
                            line2 = generateHorizontalLine();
                        }
                        break;
                    }
                } while (linesOverlap(line1, line2));
                
                crossPoints = [];
            } else {
                attempts = 0;
                
                do {
                    line2 = generateRandomLine();
                    crossPoints = getCrossPoints(line1, line2);
                    attempts++;
                    
                    if (attempts > 50) {
                        console.log("未能生成交叉路线，使用不交叉路线");
                        line2 = generateVerticalLine();
                        if (linesOverlap(line1, line2)) {
                            line2 = generateHorizontalLine();
                        }
                        crossPoints = [];
                        break;
                    }
                    
                    if (crossPoints.length >= pathConfigSettings.minCrossCells && 
                        crossPoints.length <= pathConfigSettings.maxCrossCells) {
                        break;
                    }
                    
                } while (true);
            }
            
            return { line1, line2, crossPoints };
        }
        
        function markPathCells(line1, line2, crossPoints) {
            const crossSet = new Set();
            crossPoints.forEach(point => {
                crossSet.add(`${point.row},${point.col}`);
            });
            
            for (const cell of line1) {
                if (cellTypes[cell.row][cell.col] !== 'outer') {
                    if (crossSet.has(`${cell.row},${cell.col}`)) {
                        cellTypes[cell.row][cell.col] = 'cross';
                    } else {
                        cellTypes[cell.row][cell.col] = 'path1';
                    }
                }
            }
            
            for (const cell of line2) {
                if (cellTypes[cell.row][cell.col] !== 'outer') {
                    if (!crossSet.has(`${cell.row},${cell.col}`)) {
                        cellTypes[cell.row][cell.col] = 'path2';
                    }
                }
            }
            
            return crossPoints;
        }
        
        // ========== 游戏初始化和渲染 ==========
        
        function initGame(renderOnly = false) {
            gridEl.innerHTML = '';
            
            if (!renderOnly) {
                gridData = [];
                cellTypes = [];
                
                for (let r = 0; r < GRID_SIZE; r++) {
                    gridData[r] = [];
                    cellTypes[r] = [];
                    for (let c = 0; c < GRID_SIZE; c++) {
                        gridData[r][c] = false;
                        cellTypes[r][c] = 'inner';
                    }
                }
                
                markOuterCells();
                
                const { line1, line2, crossPoints } = generateCrossingPathLines();
                pathLines = [line1, line2];
                
                markPathCells(line1, line2, crossPoints);
                
                if (crossPoints.length > 0) {
                    console.log(`生成交叉路线，交叉点数量: ${crossPoints.length}`);
                }
            }
            
            // 使用坐标填充方法
            fillGridImagesByCoord();
            
            // 渲染网格
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    
                    if (renderOnly && gridData[r] && gridData[r][c]) {
                        cell.classList.add('active');
                    }
                    
                    // 图片处理
                    const imgPath = gridImageKeys[r][c];
                    const idText = (r * 9 + c + 1);

                    if(imgPath) {
                        const img = document.createElement('img');
                        img.src = imgPath;
                        
                        // 强制图片撑满
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover';
                        img.style.display = 'block';

                        // 【核心诊断】：如果图片加载失败，显示红色文字
                        img.onerror = function() {
                            this.style.display = 'none';
                            cell.innerText = idText; // 显示数字ID
                            cell.style.color = 'red';
                            cell.style.fontSize = '12px';
                            cell.style.display = 'flex';
                            cell.style.alignItems = 'center';
                            cell.style.justifyContent = 'center';
                            cell.style.border = '1px solid red';
                            console.log('图片丢失:', imgPath);
                        };
                        
                        cell.appendChild(img);
                    } else {
                        // 如果逻辑没有生成数据，显示 ?
                        cell.innerText = "?";
                        cell.style.color = "yellow";
                    }
                    cell.addEventListener('click', () => handleClick(r, c, cell));
                    gridEl.appendChild(cell);
                }
            }
        }
        
        function generateNewGrid() {
            initGame();
        }

        function selectMode(num, btn) {
            currentTarget = num;
            ruleText.innerText = num;
            updateModeUI(num);
        }

        function updateModeUI(targetNum) {
            document.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('active');
                if(parseInt(b.getAttribute('data-mode')) === targetNum) {
                    b.classList.add('active');
                }
            });
        }

        function handleClick(r, c, cell) {
            gridData[r][c] = !gridData[r][c];
            
            if (gridData[r][c]) {
                cell.classList.add('active');
            } else {
                cell.classList.remove('active');
            }
            checkWin();
        }

        function checkWin() {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (!gridData[r][c]) continue;
                    if (checkLine(r, c, 0, 1)) return win();
                    if (checkLine(r, c, 1, 0)) return win();
                    if (checkLine(r, c, 1, 1)) return win();
                    if (checkLine(r, c, 1, -1)) return win();
                }
            }
        }

        function checkLine(startR, startC, dr, dc) {
            let count = 0;
            for (let i = 0; i < currentTarget; i++) {
                const nr = startR + dr * i;
                const nc = startC + dc * i;
                if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return false;
                if (!gridData[nr][nc]) return false;
                count++;
            }
            return count === currentTarget;
        }

        function win() {
            // 为所有选中的单元格添加获胜效果
            const activeCells = document.querySelectorAll('.cell.active');
            activeCells.forEach(cell => {
                cell.classList.add('winning');
            });
            
            // 延迟显示弹窗，让动画先播放
            setTimeout(() => {
                modal.style.display = 'flex';
                
                // 移除动画类，为下次准备
                setTimeout(() => {
                    activeCells.forEach(cell => {
                        cell.classList.remove('winning');
                    });
                }, 1500); // 动画总时长1.5秒
            }, 500);
        }

        function closeModal() {
            modal.style.display = 'none';
        }

        function exportDoc() {
            const data = {
                gridData,
                cellTypes,
                pathLines,
                currentTarget,
                gridImageKeys
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bingo_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function triggerImport() {
            fileInput.click();
        }

        function handleFileLoad(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.gridData && data.cellTypes) {
                        gridData = data.gridData;
                        cellTypes = data.cellTypes;
                        pathLines = data.pathLines || [];
                        currentTarget = data.currentTarget || 3;
                        
                        if (data.gridImageKeys) {
                            gridImageKeys = data.gridImageKeys;
                        }
                        
                        ruleText.innerText = currentTarget;
                        updateModeUI(currentTarget);
                        initGame(true); 
                        alert("导入成功！");
                    } else {
                        alert("文件格式不正确");
                    }
                } catch (error) {
                    console.error(error);
                    alert("无法读取文件");
                }
                fileInput.value = ''; 
            };
            reader.readAsText(file);
        }

        function goHome() {
            if(confirm("确定要返回主菜单吗？")) {
                window.location.href = "index.html";
            }
        }
        
        function openWeapp() {
            alert('请在微信中搜索"石火电竞"小程序');
        }

        // ========== 历史记录功能 ==========
        
        function toggleHistoryPanel() {
            const panel = document.getElementById('historyPanel');
            panel.classList.toggle('open');
        }
        
        function saveToHistory() {
            const gridImages = [];
            const cells = document.querySelectorAll('.cell img');
            cells.forEach(img => {
                gridImages.push(img.src);
            });
            
            const record = {
                id: Date.now(),
                timestamp: new Date().toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }),
                mode: currentTarget,
                gridData: JSON.parse(JSON.stringify(gridData)),
                cellTypes: JSON.parse(JSON.stringify(cellTypes)),
                pathLines: JSON.parse(JSON.stringify(pathLines)),
                gridImages: gridImages
            };
            
            historyRecords.unshift(record);
            
            if (historyRecords.length > MAX_HISTORY) {
                historyRecords = historyRecords.slice(0, MAX_HISTORY);
            }
            
            currentHistoryIndex = -1;
            
            renderHistoryList();
            updateHistoryBadge();
            saveHistoryToStorage();
        }
        
        function renderHistoryList() {
            const listEl = document.getElementById('historyList');
            
            if (historyRecords.length === 0) {
                listEl.innerHTML = '<div class="history-empty">暂无历史记录<br>点击"重新生成"开始记录</div>';
                return;
            }
            
            let html = '';
            historyRecords.forEach((record, index) => {
                const isActive = index === currentHistoryIndex ? 'active' : '';
                
                let previewHtml = '';
                for (let i = 0; i < 81; i++) {
                    const r = Math.floor(i / 9);
                    const c = i % 9;
                    const isMarked = record.gridData[r] && record.gridData[r][c] ? 'marked' : '';
                    
                    const imgSrc = record.gridImages && record.gridImages[i] ? record.gridImages[i] : '';
                    
                    if (imgSrc) {
                        previewHtml += `<div class="preview-cell ${isMarked}"><img src="${imgSrc}" onerror="this.style.display='none'"></div>`;
                    } else {
                        previewHtml += `<div class="preview-cell ${isMarked}"></div>`;
                    }
                }
                
                html += `
                    <div class="history-item ${isActive}" onclick="loadHistory(${index})">
                        <div class="time">🕒 ${record.timestamp}</div>
                        <div class="info">
                            <span>第 ${historyRecords.length - index} 次生成</span>
                            <span class="mode">${record.mode}连</span>
                        </div>
                        <div class="preview">${previewHtml}</div>
                    </div>
                `;
            });
            
            listEl.innerHTML = html;
        }
        
        function loadHistory(index) {
            if (index < 0 || index >= historyRecords.length) return;
            
            const record = historyRecords[index];
            currentHistoryIndex = index;
            
            gridData = JSON.parse(JSON.stringify(record.gridData));
            cellTypes = JSON.parse(JSON.stringify(record.cellTypes));
            pathLines = JSON.parse(JSON.stringify(record.pathLines));
            currentTarget = record.mode;
            
            ruleText.innerText = currentTarget;
            updateModeUI(currentTarget);
            
            renderGridFromHistory(record);
            renderHistoryList();
        }
        
        function renderGridFromHistory(record) {
            gridEl.innerHTML = '';
            
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    
                    if (gridData[r][c]) {
                        cell.classList.add('active');
                    }
                    
                    const index = r * 9 + c;
                    const img = document.createElement('img');
                    
                    if (record.gridImages && record.gridImages[index]) {
                        img.src = record.gridImages[index];
                    }
                    
                    img.loading = 'lazy';
                    img.width = 50;
                    img.height = 50;
                    
                    const numSpan = document.createElement('span');
                    numSpan.className = 'fallback-num';
                    numSpan.innerText = index + 1;
                    numSpan.style.display = 'none';
                    cell.appendChild(numSpan);
                    
                    img.onerror = function() { 
                        this.style.display = 'none'; 
                        numSpan.style.display = 'block'; 
                        numSpan.innerText = `加载失败`;
                        numSpan.style.color = '#ff0000';
                        numSpan.style.fontSize = '8px';
                    };
                    
                    cell.appendChild(img);
                    cell.addEventListener('click', () => handleClick(r, c, cell));
                    gridEl.appendChild(cell);
                }
            }
        }
        
        function updateHistoryBadge() {
            const badge = document.getElementById('historyBadge');
            badge.textContent = historyRecords.length;
        }
        
        function clearHistory() {
            if (historyRecords.length === 0) return;
            
            if (confirm('确定要清空所有历史记录吗？')) {
                historyRecords = [];
                currentHistoryIndex = -1;
                renderHistoryList();
                updateHistoryBadge();
                localStorage.removeItem('bingoHistory');
            }
        }
        
        function saveHistoryToStorage() {
            try {
                localStorage.setItem('bingoHistory', JSON.stringify(historyRecords));
            } catch (e) {
                console.warn('保存历史记录失败:', e);
            }
        }
        
        function loadHistoryFromStorage() {
            try {
                const saved = localStorage.getItem('bingoHistory');
                if (saved) {
                    historyRecords = JSON.parse(saved);
                    renderHistoryList();
                    updateHistoryBadge();
                }
            } catch (e) {
                console.warn('加载历史记录失败:', e);
            }
        }
        
        const originalGenerateNewGrid = generateNewGrid;
        generateNewGrid = function() {
            const cells = document.querySelectorAll('.cell img');
            if (cells.length > 0 && cells[0].src) {
                saveToHistory();
            }
            
            currentHistoryIndex = -1;
            initGame();
            renderHistoryList();
        };
        
        // ========== 图片预加载优化 ==========
        const imageCache = {};
        
        function preloadImages() {
            const imagesToPreload = [];
            
            outerConfig.images.forEach(img => imagesToPreload.push(outerConfig.folder + img));
            path1Config.fixedImages.forEach(img => imagesToPreload.push(path1Config.folder + img));
            path2Config.fixedImages.forEach(img => imagesToPreload.push(path2Config.folder + img));
            innerConfig.images.forEach(img => imagesToPreload.push(innerConfig.folder + img));
            
            let loadedCount = 0;
            const totalImages = imagesToPreload.length;
            
            imagesToPreload.forEach(src => {
                const img = new Image();
                img.onload = function() {
                    imageCache[src] = true;
                    loadedCount++;
                    if (loadedCount === totalImages) {
                        console.log(`所有 ${totalImages} 张图片预加载完成`);
                    }
                };
                img.onerror = function() {
                    console.warn(`预加载失败: ${src}`);
                    loadedCount++;
                };
                img.src = src;
            });
            
            console.log(`开始预加载 ${totalImages} 张图片...`);
        }
        
        function isImageCached(src) {
            return imageCache[src] === true;
        }

        // 初始化游戏
        // 先加载权重配置，再初始化游戏
        (async function() {
            await loadWeightsConfig();
            loadHistoryFromStorage();
            preloadImages();
            initGame();
        })();