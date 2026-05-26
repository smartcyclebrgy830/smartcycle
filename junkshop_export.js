// Pass the supabase client directly into the IIFE parameter
const JunkshopExport = ((supabaseClient) => {

    const RECYCLABLE_MATERIALS = [
        'Old Newspaper',
        'White Paper',
        'Assorted',
        'Paper/Magazines',
        'Cartons',
        'PET Bottles',
        'Plastics Containers',
        'Bottles (Glass)',
        'Aluminum',
        'Copper',
        'Tin',
        'Steel',
        'Others',
    ];

    // Case-insulated mapper to target official form category headers
    const MATERIAL_MAPPING = {
        'plastic': 'Plastics Containers',
        'pet assorted': 'PET Bottles',
        'bakal': 'Steel',
        'paper assorted': 'Paper/Magazines',
        'yero': 'Tin'
    };

    function parseCollectionDate(raw) {
        if (!raw) return null;
        const d = new Date(raw);
        return isNaN(d) ? null : d;
    }

    /**
     * Fetches collections and items directly from Supabase for the targeted month and year.
     */
    async function aggregateSupabaseData(month, year) {
        // Fallback safely if client initialization was skipped
        const db = supabaseClient || window.supabase;
        
        const result = {};
        RECYCLABLE_MATERIALS.forEach(m => {
            result[m] = {
                dailyWeights: Array(31).fill(0),
                total: 0
            };
        });

        if (!db || typeof db.from !== 'function') {
            console.error("Supabase client instance is missing or misconfigured! Dropping to local storage fallback.");
            return aggregateFallbackLocalData(month, year);
        }

        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        try {
            // 1. Fetch collections bounded within the month range
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

            // 2. Fetch price_list to decode material_ids
            const { data: priceList, error: priceError } = await db
                .from('price_list')
                .select('id, material_name');

            if (priceError) throw priceError;

            const materialMap = {};
            priceList.forEach(p => {
                materialMap[p.id] = p.material_name;
            });

            // 3. Populate matrix grid
            if (collections) {
                collections.forEach(col => {
                    const d = parseCollectionDate(col.date_collected);
                    if (!d) return;

                    const dayOfMonth = d.getDate();
                    // Maps 1-28 cleanly. Days 29, 30, 31 blend gracefully into index 27 (Day 28 slot)
                    const layoutIndex = dayOfMonth - 1;

                    (col.collection_items || []).forEach(item => {
                        const dbName = materialMap[item.material_id] || 'Others';
                        const normalizedDbName = dbName.trim().toLowerCase();
                        
                        // Check explicit mappings first, then look for loose matches in standard array
                        let standardFormName = MATERIAL_MAPPING[normalizedDbName] || 
                            RECYCLABLE_MATERIALS.find(m => m.toLowerCase() === normalizedDbName) || 
                            'Others';

                        const itemWeight = Number(item.weight) || 0;
                        
                        result[standardFormName].dailyWeights[layoutIndex] += itemWeight;
                        result[standardFormName].total += itemWeight;
                    });
                });
            }
        } catch (err) {
            console.error("Error pulling data from Supabase, looking at local cache fallback:", err);
            return aggregateFallbackLocalData(month, year);
        }

        // Clean rounding parameters
        Object.values(result).forEach(r => {
            r.total = Math.round(r.total * 100) / 100;
            r.dailyWeights = r.dailyWeights.map(w => Math.round(w * 100) / 100);
        });

        return result;
    }

    function aggregateFallbackLocalData(month, year) {
        const raw = JSON.parse(localStorage.getItem('smartCycleCollections') || '[]');
        const result = {};
        RECYCLABLE_MATERIALS.forEach(m => {
            result[m] = { dailyWeights: Array(28).fill(0), total: 0 };
        });
        
        raw.forEach(col => {
            const d = parseCollectionDate(col.date);
            if (!d || d.getMonth() !== month || d.getFullYear() !== year) return;
            const dayIdx = Math.min(28, d.getDate()) - 1;
            
            (col.items || []).forEach(item => {
                const mat = item.material;
                const known = RECYCLABLE_MATERIALS.find(m => m.toLowerCase() === mat.toLowerCase()) || 'Others';
                const wt = Number(item.weight) || 0;
                result[known].dailyWeights[dayIdx] += wt;
                result[known].total += wt;
            });
        });
        return result;
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

        const now        = new Date();
        const month      = opts.month ?? now.getMonth();
        const year       = opts.year  ?? now.getFullYear();
        
        const data       = await aggregateSupabaseData(month, year);
        const monthLabel = `${MONTHS[month]} ${year}`;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const W   = doc.internal.pageSize.getWidth();   
        const H   = doc.internal.pageSize.getHeight();  
        const ML  = 30, MR = 30;
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

        // Image loader logic
        const loadImage = async (path) => {
            try {
                const resp = await fetch(path);
                if (!resp.ok) return null;
                const blob = await resp.blob();
                return await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload  = () => res(r.result);
                    r.onerror = rej;
                    r.readAsDataURL(blob);
                });
            } catch { return null; }
        };

        const logoW = 54, logoH = 54;
        const logoY = y + 10;
        const centerX = W / 2;

        const leftLogoData  = await loadImage('photo/left_logo.jpg');
        const rightLogoData = await loadImage('photo/right_logo.png');
        if (leftLogoData)  doc.addImage(leftLogoData,  'JPEG', centerX - 200 - logoW, logoY, logoW, logoH);
        if (rightLogoData) doc.addImage(rightLogoData, 'PNG',   centerX + 200,         logoY, logoW, logoH);

        ctext('Republic of the Philippines',    y + 13, 9.5, 'normal');
        ctext('City of Manila',                y + 25,  9.5, 'normal');
        ctext('DEPARTMENT OF PUBLIC SERVICES', y + 42, 17,  'bold', [0, 70, 150]);
        ctext('Manila, Philippines',           y + 57, 9.5, 'normal');

        y += 70;
        hline(ML, W - MR, y,     2.5);
        hline(ML, W - MR, y + 4, 0.8);
        y += 14;

        ctext('JUNKSHOP MONITORING FORM', y + 12, 13, 'bold');
        y += 20;
        ctext('Data Sheet', y + 2, 10.5, 'normal');
        y += 14;

        ltext('Month: ', ML, y, 10, 'normal');
        const mw = doc.getTextWidth('Month: ');
        hline(ML + mw, ML + mw + 140, y + 1, 0.6);
        if (monthLabel) ltext(monthLabel, ML + mw + 2, y, 10, 'normal');
        y += 18;

        const field = (label, value, x, yy, ulLen) => {
            ltext(label, x, yy, 9, 'bold');
            const lw = doc.getTextWidth(label);
            if (value) ltext(value, x + lw + 1, yy, 9, 'normal');
            hline(x + lw + 1, x + lw + 1 + ulLen, yy + 1.5, 0.5);
        };

        field('Junkshop Name: ', opts.junkshopName || '', ML,       y, 130);
        field('Address: ',       opts.address      || '', ML + 240, y, 170);
        field('Brgy: ',    opts.barangay || '', ML + 490, y, 55);
        field('Zone: ',    opts.zone     || '', ML + 583, y, 35);
        field('District: ', opts.district || '', ML + 648, y, 60);
        y += 14;

        field('Owner: ',            opts.owner          || '', ML,       y, 110);
        field('Mobile No. : ',      opts.mobile         || '', ML + 207, y, 80);
        field('Landline: ',         opts.landline        || '', ML + 350, y, 75);
        field('Date Established: ', opts.dateEstablished || '', ML + 480, y, 60);
        field('Floor Area: ',       opts.floorArea       || '', ML + 612, y, 45);
        field('No. of Aide: ',      opts.noOfAide        || '', ML + 694, y, 40);
        y += 12;

        hline(ML, W - MR, y,     2);
        hline(ML, W - MR, y + 4, 0.6);
        y += 12;

        const colMat   = 88;
        const colTotal = 44;
        const colWeeks = usableW - colMat - colTotal;
        const colWeek  = colWeeks / 4;
        const dayCount = 7;
        const dayW     = colWeek / dayCount;

        const rh0 = 16, rh1 = 14, rh2 = 11, rh3 = 13;  
        const nMat = RECYCLABLE_MATERIALS.length;
        const tableH = rh0 + rh1 + rh2 + (nMat + 2) * rh3;  
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
        doc.text('Total',   totX + colTotal / 2, ry + (rh1 + rh2) / 2 + 9, { align: 'center' });

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

        RECYCLABLE_MATERIALS.forEach(mat => {
            const item = data[mat];

            box(ML, ry, colMat, rh3);
            doc.setFont('times', 'normal'); doc.setFontSize(8);
            doc.text(mat, ML + 3, ry + rh3 - 4);

            wx = ML + colMat;
            doc.setFont('times', 'normal'); doc.setFontSize(6.5);

            const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
            
            for (let i = 0; i < totalDaysInMonth; i++) {
                box(wx, ry, dayW, rh3);
                const dayWeight = item.dailyWeights[i];

                if (dayWeight > 0) {
                    doc.text(dayWeight.toFixed(1), wx + dayW / 2, ry + rh3 - 4, { align: 'center' });
                } else {
                    doc.text('-', wx + dayW / 2, ry + rh3 - 4, { align: 'center' });
                }
                wx += dayW;
            }

            box(totX, ry, colTotal, rh3);
            if (item.total > 0) {
                doc.setFont('times', 'bold'); doc.setFontSize(8);
                doc.text(item.total.toFixed(1), totX + colTotal / 2, ry + rh3 - 4, { align: 'center' });
            } else {
                doc.setFont('times', 'normal'); doc.setFontSize(8);
                doc.text('-', totX + colTotal / 2, ry + rh3 - 4, { align: 'center' });
            }

            ry += rh3;
        });

        for (let i = 0; i < 2; i++) {
            box(ML, ry, colMat, rh3);
            wx = ML + colMat;
            for (let d = 0; d < 4 * dayCount; d++) { box(wx, ry, dayW, rh3); wx += dayW; }
            box(totX, ry, colTotal, rh3);
            ry += rh3;
        }

        y = ry + 16;

        ltext('Certified by:', ML, y, 9, 'bold');
        ltext('Monitored by:', W / 2 + 8, y, 9, 'bold');
        y += 28;

        const sigL = 175, dateL = 75;
        hline(ML,          ML + sigL,                  y, 0.8);
        hline(ML + sigL + 14, ML + sigL + 14 + dateL, y, 0.8);
        hline(W / 2 + 8,              W / 2 + 8 + sigL,                  y, 0.8);
        hline(W / 2 + 8 + sigL + 14,  W / 2 + 8 + sigL + 14 + dateL,    y, 0.8);

        y += 9;
        ltext('Junkshop Owner/In-Charge', ML,                    y, 9,   'bold');
        ltext('Date',                     ML + sigL + 20,        y, 9,   'normal');
        ltext('DPS - Monitoring',         W / 2 + 8,             y, 9,   'bold');
        ltext('Date',                     W / 2 + 8 + sigL + 20, y, 9,   'normal');

        y += 12;
        ltext('(Signature over printed name)', ML,        y, 7.5, 'normal');
        ltext('(Signature over printed name)', W / 2 + 8, y, 7.5, 'normal');

        y += 22;
        hline(ML, W - MR, y,     2.5);
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

    return { exportPDF, aggregateData: aggregateSupabaseData, RECYCLABLE_MATERIALS };

// Send your global instance inside the executing wrapper parameter
})(window.supabase);
