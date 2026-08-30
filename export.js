import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

/**
 * 1. تصدير البيانات إلى ملف Excel (.xlsx)
 * عملي جداً للمحاسبة والمراجعة
 */
export const exportToExcel = async (data, fileName = 'Report') => {
  try {
    // تحويل البيانات (مصفوفة) إلى ورقة عمل إكسل
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'البيانات');

    // توليد الملف بصيغة Base64 لحفظه في الجهاز
    const base64Data = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filePath = `${FileSystem.documentDirectory}${fileName}.xlsx`;

    // حفظ الملف محلياً
    await FileSystem.writeAsStringAsync(filePath, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // فتح نافذة المشاركة/الحفظ للمستخدم
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'حفظ تقرير الإكسل',
    });

    return true;
  } catch (error) {
    console.error('خطأ في تصدير الإكسل:', error);
    return false;
  }
};

/**
 * 2. تصدير البيانات إلى صفحة HTML فاخرة
 * تصميم أبيض رسمي ومبهر، جاهز للطباعة المباشرة
 */
export const exportToHTML = async (reportTitle, data, fileName = 'Report') => {
  try {
    // استخراج عناوين الأعمدة من مفاتيح أول عنصر في البيانات
    const headers = data.length > 0 ? Object.keys(data[0]) : [];

    // بناء قالب HTML فاخر مع CSS مدمج
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reportTitle}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #F8FAFC;
            color: #0F172A;
            margin: 0;
            padding: 40px;
          }
          .report-container {
            background-color: #FFFFFF;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            max-width: 1000px;
            margin: auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #F1F5F9;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1E293B;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            color: #64748B;
            margin: 0;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            padding: 15px;
            text-align: right;
            border-bottom: 1px solid #E2E8F0;
          }
          th {
            background-color: #F8FAFC;
            color: #334155;
            font-weight: bold;
            font-size: 15px;
          }
          td {
            color: #475569;
            font-size: 14px;
          }
          tr:hover {
            background-color: #F1F5F9;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #94A3B8;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header">
            <h1>${reportTitle}</h1>
            <p>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                ${headers.map(header => `<th>${header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(key => `<td>${row[key]}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>تم إصدار هذا التقرير آلياً بواسطة نظام الإدارة الشامل</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const filePath = `${FileSystem.documentDirectory}${fileName}.html`;

    // حفظ ملف HTML محلياً
    await FileSystem.writeAsStringAsync(filePath, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // فتح نافذة المشاركة/الطباعة
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/html',
      dialogTitle: 'عرض وطباعة التقرير',
    });

    return true;
  } catch (error) {
    console.error('خطأ في تصدير HTML:', error);
    return false;
  }
};
