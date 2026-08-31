import * as XLSX from 'xlsx';

/**
 * 1. تصدير البيانات إلى ملف Excel (.xlsx) عبر المتصفح مباشرة
 */
export const exportToExcel = (data, fileName = 'Report') => {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('لا توجد بيانات للتصدير');
      return false;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'البيانات');

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    return true;
  } catch (error) {
    console.error('خطأ في تصدير الإكسل:', error);
    return false;
  }
};

/**
 * 2. تصدير البيانات إلى صفحة HTML وعرضها للطباعة الفورية (مع حماية آمنة للمصفوفات)
 */
export const exportToHTML = (reportTitle, data, fileName = 'Report') => {
  try {
    // التأكد التام أن البيانات مصفوفة وليست فارغة وأن العنصر الأول كائن صالح
    if (!Array.isArray(data) || data.length === 0 || !data[0]) {
      console.warn('لا توجد بيانات للتقرير أو البيانات غير صالحة');
      return false;
    }

    const headers = Object.keys(data[0]);
    if (!Array.isArray(headers) || headers.length === 0) {
      console.warn('لا توجد حقول (أعمدة) للعرض');
      return false;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle}</title>
        <style>
          body { font-family: Tahoma, sans-serif; background: #F8FAFC; color: #0F172A; padding: 30px; direction: rtl; }
          .container { background: #FFF; padding: 20px; border-radius: 8px; max-width: 900px; margin: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          h1 { text-align: center; color: #1E293B; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; text-align: right; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
          th { background: #F1F5F9; color: #334155; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #94A3B8; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${reportTitle}</h1>
          <p style="text-align: center; color: #64748B; font-size: 13px;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}˼th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(key => `<td>${row && row[key] !== undefined ? row[key] : ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>نظام الإدارة الشامل - صادر آلياً</p>
          </div>
        </div>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة لعرض التقرير');
      return false;
    }

    return true;
  } catch (error) {
    console.error('خطأ في تصدير HTML:', error);
    return false;
  }
};
