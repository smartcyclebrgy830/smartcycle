const JunkshopExport = (() => {

    function parseCollectionDate(raw) {
        if (!raw) return null;
        // Handle explicit local date format extraction
        const d = new Date(raw);
        return isNaN(d) ? null : d;
    }

    async function aggregateSupabaseData(month, year) {
        const db = window._supabase || null;
        
        let materialsList = [];
        const result = {};

        // Fallback to reading dynamic local storage schema structures if DB is offline
        if (!db || typeof db.from !== 'function') {
            console.warn("Supabase context missing. Diverting to local storage dynamic fallback schema mapping.");
            return aggregateFallbackLocalData(month, year);
        }

        try {
            // Fetch live active records directly from price_list table
            const { data: priceList, error: priceError } = await db
                .from('price_list')
                .select('id, material_name')
                .order('id', { ascending: true }); 

            if (priceError) throw priceError;

            if (!priceList || priceList.length === 0) {
                throw new Error("The price_list table returned no active materials.");
            }

            // Map out names and IDs cleanly 
            const materialMap = {};
            priceList.forEach(p => {
                materialMap[p.id] = p.material_name;
                if (!materialsList.includes(p.material_name)) {
                    materialsList.push(p.material_name);
                }
            });

            // Ensure "Others" is consistently grouped at the bottom row boundary
            if (!materialsList.includes('Others')) {
                materialsList.push('Others');
            }

            // Build structural cells dynamically based on the database materials list
            materialsList.forEach(m => {
                result[m] = {
                    dailyWeights: Array(32).fill(0), // Days 1 to 31 mapping 
                    total: 0
                };
            });

            // Set up month parameters (Ensure proper 1-based padding for API queries)
            const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            // Query historical records across related collection sub-tables
            const { data: collections, error } = await db
                .from('collections')
                .select(`
                    id,
                    date_collected,
                    collection_items (
                        weight,
                        material_id
                    )
                `)
                .gte('date_collected', startDate)
                .lte('date_collected', endDate);

            if (error) throw error;

            // Matrix distribution processing
            if (collections) {
                collections.forEach(col => {
                    const d = parseCollectionDate(col.date_collected);
                    if (!d) return;

                    const dayOfMonth = d.getDate(); // Explicit day (1 to 31)
                    if (dayOfMonth > 28) return;

                    (col.collection_items || []).forEach(item => {
                        const matchedMaterialName = materialMap[item.material_id] || 'Others';
                        const itemWeight = Number(item.weight) || 0;
                        
                        if (result[matchedMaterialName]) {
                            result[matchedMaterialName].dailyWeights[dayOfMonth] += itemWeight;
                            result[matchedMaterialName].total += itemWeight;
                        } else {
                            result['Others'].dailyWeights[dayOfMonth] += itemWeight;
                            result['Others'].total += itemWeight;
                        }
                    });
                });
            }
        } catch (err) {
            console.error("Database tracking fault occurred. Diverting parsing workflow down to local browser fallback:", err);
            return aggregateFallbackLocalData(month, year);
        }

        // Clean values to neat decimal limits
        Object.values(result).forEach(r => {
            r.total = Math.round(r.total * 100) / 100;
            for (let d = 1; d <= 31; d++) {
                r.dailyWeights[d] = Math.round(r.dailyWeights[d] * 100) / 100;
            }
        });

        return { dataGrid: result, materialsList };
    }

    function aggregateFallbackLocalData(month, year) {
        const raw = JSON.parse(localStorage.getItem('smartCycleCollections') || '[]');
        const materialsSet = new Set();
        const result = {};

        raw.forEach(col => {
            (col.items || col.collection_items || []).forEach(item => {
                if (item.material) materialsSet.add(item.material);
            });
        });

        const materialsList = Array.from(materialsSet);
        if (!materialsList.includes('Others')) {
            materialsList.push('Others');
        }

        materialsList.forEach(m => {
            result[m] = { dailyWeights: Array(32).fill(0), total: 0 };
        });

        raw.forEach(col => {
            const d = parseCollectionDate(col.date || col.date_collected);
            if (!d || d.getMonth() !== month || d.getFullYear() !== year) return;
            const dayOfMonth = d.getDate();
            if (dayOfMonth > 28) return;

            (col.items || col.collection_items || []).forEach(item => {
                const mat = item.material || 'Others';
                const known = materialsList.find(m => m.toLowerCase() === mat.toLowerCase()) || 'Others';
                const wt = Number(item.weight) || 0;

                result[known].dailyWeights[dayOfMonth] += wt;
                result[known].total += wt;
            });
        });

        return { dataGrid: result, materialsList };
    }

    const MONTHS = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];

    async function exportPDF(opts = {}) {
        const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDF) {
            alert('jsPDF failed to load. Please refresh the page and try again.');
            return;
        }

        const now = new Date();
        const month = opts.month ?? now.getMonth();
        const year = opts.year ?? now.getFullYear();

        // Fetch grid information directly mapping down from Supabase
        const { dataGrid, materialsList } = opts.reportData || await aggregateSupabaseData(month, year);
        const monthLabel = `${MONTHS[month]} ${year}`;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'legal' });
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const ML = 30, MR = 30;
        const usableW = W - ML - MR;

        let y = 18;

        const ctext = (txt, yy, sz, sty = 'normal', col = [0,0,0]) => {
            doc.setFont('times', sty); doc.setFontSize(sz); doc.setTextColor(...col);
            doc.text(txt, W / 2, yy, { align: 'center' });
        };

        const ltext = (txt, xx, yy, sz, sty = 'normal') => {
            doc.setFont('times', sty); doc.setFontSize(sz); doc.setTextColor(0,0,0);
            doc.text(txt, xx, yy);
        };

        const hline = (x1, x2, yy, lw = 0.5) => {
            doc.setLineWidth(lw); doc.setDrawColor(0,0,0); doc.line(x1, yy, x2, yy);
        };

        const box = (x, yy, w, h) => {
            doc.setDrawColor(0,0,0); doc.setLineWidth(0.4); doc.rect(x, yy, w, h, 'S');
        };

        // Improved image loader preventing code crash on 404 failure loops
        const loadImage = async (path) => {
            try {
                const resp = await fetch(path);
                if (!resp.ok) return null;
                const blob = await resp.blob();
                return await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = () => res(null); // Resolve null rather than crash mapping threads
                    r.readAsDataURL(blob);
                });
            } catch { return null; }
        };

        const logoW = 54, logoH = 54;
        const logoY = y + 10;
        const centerX = W / 2;

        const leftLogoData = await loadImage('photo/left_logo.jpg');
        const rightLogoData = await loadImage('photo/right_logo.png');
        if (leftLogoData) doc.addImage(leftLogoData, 'JPEG', centerX - 200 - logoW, logoY, logoW, logoH);
        if (rightLogoData) doc.addImage(rightLogoData, 'PNG', centerX + 200, logoY, logoW, logoH);

        ctext('Republic of the Philippines', y + 13, 9.5, 'normal');
        ctext('City of Manila', y + 25, 9.5, 'normal');
        ctext('DEPARTMENT OF PUBLIC SERVICES', y + 42, 17, 'bold', [0, 70, 150]);
        ctext('Manila, Philippines', y + 57, 9.5, 'normal');

        y += 70;
        hline(ML, W - MR, y, 2.5);
        hline(ML, W - MR, y + 4, 0.8);
        y += 14;

        ctext('JUNKSHOP MONITORING FORM', y + 12, 13, 'bold');
        y += 20;
        ctext('Data Sheet', y + 2, 10.5, 'normal');
        y += 14;

        ctext('Month: ' + monthLabel, y, 10, 'normal');
        const mw = doc.getTextWidth('Month: ' + monthLabel);
        const mwLabel = doc.getTextWidth('Month: ');
        hline(W/2 - mw/2 + mwLabel, W/2 + mw/2, y + 1, 0.6);
        y += 18;

        const field = (label, value, x, yy, ulLen) => {
            ltext(label, x, yy, 9, 'bold');
            const lw = doc.getTextWidth(label);
            // Corrected parameter positioning: text first, then numeric coordinates
            if (value) ltext(String(value), x + lw + 1, yy, 9, 'normal'); 
            hline(x + lw + 1, x + lw + 1 + ulLen, yy + 1.5, 0.5);
        };

        field('Junkshop Name: ', opts.junkshopName || 'TEZWA', ML, y, 220);
        field('Address: ', opts.address || 'BRGY. 830 SOUTH NAGTAHAN, PACO, MANILA', ML + 310, y, 170);
        field('Brgy: ', opts.barangay || '830', ML + 540, y, 55);
        field('Zone: ', opts.zone || '90', ML + 640, y, 35);
        field('District: ', opts.district || '6', ML + 720, y, 60);
        y += 14;

        field('Owner: ', opts.owner || '', ML, y, 110);
        field('Mobile No. : ', opts.mobile || '', ML + 170, y, 80);
        field('Landline: ', opts.landline || '', ML + 340, y, 75);
        field('Date Established: ', opts.dateEstablished || '', ML + 470, y, 70);
        field('Floor Area: ', opts.floorArea || '', ML + 620, y, 50);
        field('No. of Aide: ', opts.noOfAide || '', ML + 740, y, 45);
        y += 12;

        hline(ML, W - MR, y, 2);
        hline(ML, W - MR, y + 4, 0.6);
        y += 12;

        // Custom Layout Calculations
        const colMat = 88;
        const colTotal = 44;
        const colWeeks = usableW - colMat - colTotal;
        const colWeek = colWeeks / 4; // Width allocation for each week cluster
        const dayCount = 7;
        const dayW = colWeek / dayCount; // Visual column space width per structural grid square node

        const rh0 = 16, rh1 = 14, rh2 = 11, rh3 = 13;
        const nMat = materialsList.length;
        
        // Pre-calculate wrapped name lines + row height for every material, since
        // long names may need more vertical space than the default rh3
        doc.setFont('times', 'bold'); doc.setFontSize(8);
        const maxNameWidth = colMat - 8;
        const lineH = 8;
        const rowInfo = materialsList.map(mat => {
            const nameLines = doc.splitTextToSize(mat, maxNameWidth);
            const rowH = Math.max(rh3, nameLines.length * lineH + 4);
            return { nameLines, rowH };
        });
        
        const dataRowsH = rowInfo.reduce((sum, r) => sum + r.rowH, 0);
        const tableH = rh0 + rh1 + rh2 + dataRowsH + (2 * rh3); // +2 rh3 keeps space for the trailing rows below the data (totals/footer rows)
        const tableTop = y;
        
        doc.setDrawColor(0,0,0);
        doc.setLineWidth(0.8);
        doc.rect(ML, tableTop, usableW, tableH, 'S');

        let ry = tableTop;
        hline(ML, ML + usableW, ry + rh0, 0.6);
        doc.setFont('times', 'bold'); doc.setFontSize(9);
        doc.text('COLLECTED RECYCLABLE MATERIALS (Kilos / Day)', W / 2, ry + rh0 - 4, { align: 'center' });
        ry += rh0;

        box(ML, ry, colMat, rh1 + rh2);
        const totX = ML + colMat + colWeeks;
        box(totX, ry, colTotal, rh1 + rh2);

        let wx = ML + colMat;
        doc.setFont('times', 'bold'); doc.setFontSize(8.5);
        for (let w = 1; w <= 4; w++) {
            box(wx, ry, colWeek, rh1);
            doc.text(`WEEK ${w}`, wx + colWeek / 2, ry + rh1 - 4, { align: 'center' });
            wx += colWeek;
        }

        doc.setFontSize(8);
        doc.text('RECYCLABLE', ML + colMat / 2, ry + (rh1 + rh2) / 2 + 3, { align: 'center' });

        doc.setFontSize(7.5);
        doc.text('Monthly', totX + colTotal / 2, ry + (rh1 + rh2) / 2 - 1, { align: 'center' });
        doc.text('Total', totX + colTotal / 2, ry + (rh1 + rh2) / 2 + 9, { align: 'center' });

        ry += rh1;

        wx = ML + colMat;
        doc.setFont('times', 'bold'); doc.setFontSize(6.5);
        for (let w = 0; w < 4; w++) {
            for (let d = 1; d <= dayCount; d++) {
                box(wx, ry, dayW, rh2);
                doc.text(`D ${d}`, wx + dayW / 2, ry + rh2 - 3, { align: 'center' });
                wx += dayW;
            }
        }
        ry += rh2;

        // Render Data Rows dynamically from price_list active items
        materialsList.forEach(mat => {
            const item = dataGrid[mat] || { dailyWeights: Array(32).fill(0), total: 0 };
            
            // 1. Draw the Recyclable Material Name column
            const ri = rowInfo[materialsList.indexOf(mat)];
                    box(ML, ry, colMat, ri.rowH);
            doc.setFont('times', 'bold'); doc.setFontSize(8);
            ri.nameLines.forEach((line, li) => {
                doc.text(line, ML + 4, ry + 10 + (li * lineH));
            });
            
            // 2. Reset X-coordinate to start drawing the 28 days
            wx = ML + colMat;
            
            for (let i = 0; i < 28; i++) {
                box(wx, ry, dayW, ri.rowH);
                let dayNumber = i + 1;
                let wt = item.dailyWeights[dayNumber] || 0;
                let displayStr = wt > 0 ? wt.toFixed(1) : '-';
                doc.setFontSize(7);
                doc.setFont('times', 'normal');
                doc.text(displayStr, wx + dayW / 2, ry + rh3 - 4, { align: 'center' });
                wx += dayW;
            }
            
            // 3. Draw the Monthly Totals Column right at the end of Day 28
            box(totX, ry, colTotal, ri.rowH);
            if (item.total > 0) {
                doc.setFont('times', 'bold'); doc.setFontSize(8);
                doc.text(item.total.toFixed(1), totX + colTotal / 2, ry + rh3 - 4, { align: 'center' });
            } else {
                doc.setFont('times', 'normal'); doc.setFontSize(8);
                doc.text('-', totX + colTotal / 2, ry + rh3 - 4, { align: 'center' });
            }
            
            // Move down to the next row coordinate
            ry += ri.rowH;
        });
    
        y = ry + 16;

        ltext('Certified by:', ML, y, 9, 'bold');
        ltext('Monitored by:', W / 2 + 8, y, 9, 'bold');
        y += 28;

        const sigL = 175, dateL = 75;
        hline(ML, ML + sigL, y, 0.8);
        hline(ML + sigL + 14, ML + sigL + 14 + dateL, y, 0.8);
        hline(W / 2 + 8, W / 2 + 8 + sigL, y, 0.8);
        hline(W / 2 + 8 + sigL + 14, W / 2 + 8 + sigL + 14 + dateL, y, 0.8);

        y += 9;
        ltext('Junkshop Owner/In-Charge', ML, y, 9, 'bold');
        ltext('Date', ML + sigL + 20, y, 9, 'normal');
        ltext('DPS - Monitoring', W / 2 + 8, y, 9, 'bold');
        ltext('Date', W / 2 + 8 + sigL + 20, y, 9, 'normal');

        y += 12;
        ltext('(Signature over printed name)', ML, y, 7.5, 'normal');
        ltext('(Signature over printed name)', W / 2 + 8, y, 7.5, 'normal');

        y += 22;
        hline(ML, W - MR, y, 2.5);
        hline(ML, W - MR, y + 4, 0.8);
        y += 18;

        ctext('\u201CBayanihan para sa Malinis na Kapaligiran\u201D', y, 10.5, 'bolditalic', [0, 70, 150]);
        y += 14;
        ctext('Ground Floor, Old Comelec Bldg. Lion\'s Road, Arroceros Street, Ermita Manila', y, 7.5);
        y += 11;
        ctext('Tel. no.: (02) 527 4967/ (02) 310 1261', y, 7.5);
        y += 11;
        ctext('Email: dps.cityofmanila@gmail.com', y, 7.5);

        doc.save(`JunkshopMonitoringForm_${MONTHS[month]}${year}.pdf`);
    }

    async function exportCSV(opts = {}) {
        try {
            const now = new Date();
            const month = opts.month ?? now.getMonth();
            const year  = opts.year ?? now.getFullYear();
    
            // Use already computed data if available
            const { dataGrid, materialsList } =
                opts.reportData || await aggregateSupabaseData(month, year);
    
            if (!dataGrid || !materialsList || materialsList.length === 0) {
                alert("No data available for CSV export.");
                return;
            }
    
            const rows = [];
            rows.push([`Junkshop: ${opts.junkshopName || ""}`]);
            rows.push([`Address: ${opts.address || ""}`]);
            rows.push([`Month: ${month + 1}/${year}`]);
            rows.push([]); // empty row
            // HEADER ROW
            rows.push([
                "Material",
                "Week 1",
                "Week 2",
                "Week 3",
                "Week 4",
                "Total"
            ]);
    
            // PROCESS EACH MATERIAL
            materialsList.forEach(mat => {
                const item = dataGrid[mat] || { dailyWeights: Array(32).fill(0), total: 0 };
    
                let w1 = 0, w2 = 0, w3 = 0, w4 = 0;
    
                // Week 1 (Day 1–7)
                for (let d = 1; d <= 7; d++) w1 += item.dailyWeights[d] || 0;
    
                // Week 2 (8–14)
                for (let d = 8; d <= 14; d++) w2 += item.dailyWeights[d] || 0;
    
                // Week 3 (15–21)
                for (let d = 15; d <= 21; d++) w3 += item.dailyWeights[d] || 0;
    
                // Week 4 (22–28)
                for (let d = 22; d <= 28; d++) w4 += item.dailyWeights[d] || 0;
    
                rows.push([
                    mat,
                    w1.toFixed(1),
                    w2.toFixed(1),
                    w3.toFixed(1),
                    w4.toFixed(1),
                    item.total.toFixed(1)
                ]);
            });
    
            // CONVERT TO CSV STRING
            const csvContent = rows
                .map(row => row.map(val => `"${val}"`).join(","))
                .join("\n");
    
            // CREATE DOWNLOAD
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
    
            const a = document.createElement("a");
            a.href = url;
            a.download = `junkshop_report_${year}_${month + 1}.csv`;
            a.click();
    
            URL.revokeObjectURL(url);
    
        } catch (err) {
            console.error("CSV export error:", err);
            alert("CSV export failed.");
        }
    }

    return {
    aggregateSupabaseData,
    exportPDF,
    exportCSV
};
})();

window.JunkshopExport = JunkshopExport;
