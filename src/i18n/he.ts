// Hebrew copy. Gender neutral: plural or impersonal forms. Short, warm, plain.
// Keys marked "SPEC" are fixed by SPEC.md section 9.

export const he = {
  'app.footer': '{name} · גרסה {version} · MVP של פרויקט בקורס',
  'common.loading': 'בטעינה…',
  'common.retry': 'לנסות שוב',
  'common.cancel': 'ביטול',
  'common.save': 'שמירה',
  'common.close': 'סגירה',
  'common.back': 'חזרה',

  'welcome.tagline': 'תמיד יודעים כמה נשאר עד החיוב הבא', // SPEC
  'welcome.create': 'פתיחת קופה משותפת', // SPEC
  'welcome.join': 'הצטרפות עם קוד', // SPEC (hidden in the fast lane)
  'welcome.demo': 'צפייה בדמו', // SPEC
  'welcome.privacy': 'בלי חיבור לבנק. הכול נשמר במכשיר הזה.',

  'create.title': 'פתיחת קופה משותפת',
  'create.name': 'איך קוראים לך?', // SPEC
  'create.budget': 'כמה אתם רוצים להוציא בכל מחזור?', // SPEC
  'create.budgetPlaceholder': 'לדוגמה 9000',
  'create.cycleDay': 'באיזה יום מתחיל המחזור?', // SPEC
  'create.cycleHelp': 'רוב האנשים בוחרים את יום החיוב של כרטיס האשראי. אפשר לשנות אחר כך.', // SPEC
  'create.dayOption': '{day} בחודש',
  'create.submit': 'יצירה',
  'create.nameRequired': 'צריך למלא שם.',
  'create.budgetInvalid': 'מקלידים סכום גדול מאפס ועד {max}.',
  'create.error': 'לא הצלחנו ליצור את הקופה. לנסות שוב?',

  'home.cycleLabel': '{start} עד {end}',
  'home.left': 'נשארו {amount} במחזור הזה', // SPEC
  'home.over': 'חריגה של {amount}', // SPEC
  'home.daysLeft': 'עוד {n} ימים · בערך {amount} ליום', // SPEC
  'home.daysLeftOnly': 'עוד {n} ימים',
  'home.lastDay': 'יום אחרון במחזור', // SPEC
  'home.spentOf': 'הוצאתם {spent} מתוך {budget}', // SPEC
  'home.progress': 'התקציב נוצל ב-{percent}%',
  'home.empty': 'עוד אין הוצאות במחזור הזה. לוחצים על + כדי להוסיף את הראשונה.', // SPEC
  'home.today': 'היום', // SPEC
  'home.yesterday': 'אתמול', // SPEC
  'home.listTitle': 'ההוצאות במחזור',
  'home.add': 'הוספת הוצאה',
  'home.settings': 'הגדרות',
  'home.paidBy': 'שולם על ידי {name}',
  'home.loadError': 'לא הצלחנו לטעון את הנתונים.',

  'add.title': 'הוצאה חדשה', // SPEC
  'add.hint': 'מקלידים סכום ובוחרים קטגוריה', // SPEC
  'add.tooMuch': 'אפשר עד {max}',
  'add.amount': 'סכום',
  'add.categories': 'קטגוריה',
  'key.backspace': 'מחיקת ספרה',
  'key.dot': 'נקודה עשרונית',

  'toast.saved': 'נשמר ✓', // SPEC
  'toast.undo': 'ביטול', // SPEC
  'toast.undone': 'ההוצאה בוטלה',
  'toast.updated': 'השינויים נשמרו',
  'toast.deleted': 'ההוצאה נמחקה',
  'toast.goneElsewhere': 'ההוצאה הזאת נמחקה במקום אחר',
  'toast.actionFailed': 'משהו לא הצליח. לנסות שוב?',

  'error.save': 'לא הצלחנו לשמור. לנסות שוב?', // SPEC
  'error.title': 'משהו השתבש',
  'error.body': 'הנתונים שמורים במכשיר. אפשר לנסות שוב.',

  'edit.title': 'עריכת הוצאה',
  'edit.date': 'תאריך',
  'edit.dateInvalid': 'אפשר לבחור תאריך מהשנה האחרונה, לא בעתיד.',
  'edit.paidBy': 'שולם על ידי',
  'edit.save': 'שמירה',
  'edit.delete': 'מחיקה', // SPEC
  'edit.deleteConfirm': 'למחוק את ההוצאה?', // SPEC
  'edit.deleteYes': 'כן, למחוק',

  'settings.title': 'הגדרות',
  'settings.members': 'מי בקופה',
  'settings.thisDevice': 'במכשיר הזה',
  'settings.editName': 'עריכת השם',
  'settings.yourName': 'השם שלך',
  'settings.budgetSection': 'תקציב ומחזור',
  'settings.budget': 'תקציב לכל מחזור',
  'settings.cycleDay': 'יום תחילת המחזור',
  'settings.cycleHelp': 'השינוי חל מיד על המחזור הנוכחי.', // SPEC
  'settings.saved': 'נשמר',
  'settings.export': 'ייצוא נתונים',
  'settings.exportExpenses': 'הורדת הוצאות (CSV)',
  'settings.exportEvents': 'הורדת אירועים (CSV)',
  'settings.demo': 'מצב הדגמה',
  'settings.resetDemo': 'איפוס הדמו',
  'settings.resetDemoDone': 'הדמו חזר להתחלה',
  'settings.exitDemo': 'יציאה מהדמו',
  'settings.danger': 'ניתוק',
  'settings.disconnect': 'ניתוק המכשיר הזה',
  'settings.disconnectWarnLocal':
    'כל ההוצאות שנשמרו במכשיר הזה יימחקו, ואי אפשר יהיה לשחזר אותן. כדאי להוריד אותן קודם כקובץ CSV.',
  'settings.disconnectYes': 'כן, לנתק ולמחוק',

  'demo.banner': 'מצב הדגמה', // SPEC
  'demo.exit': 'יציאה',
} as const

export type MessageKey = keyof typeof he
