// Hebrew copy. Gender neutral: plural or impersonal forms. Short, warm, plain.
// Keys marked "SPEC" are fixed by SPEC.md section 9.

export const he = {
  'app.footer': '{name} · גרסה {version} · MVP של פרויקט בקורס',
  'app.copyright': '© {year} {owner}. כל הזכויות שמורות.',
  'common.loading': 'בטעינה…',
  'common.retry': 'לנסות שוב',
  'common.cancel': 'ביטול',
  'common.save': 'שמירה',
  'common.close': 'סגירה',
  'common.back': 'חזרה',
  'common.copied': 'הקוד הועתק',
  'common.copyFailed': 'לא הצלחנו להעתיק. אפשר לסמן את הקוד ולהעתיק אותו.',

  'welcome.tagline': 'תמיד יודעים כמה נשאר עד החיוב הבא', // SPEC
  'welcome.create': 'פתיחת קופה משותפת', // SPEC
  'welcome.join': 'הצטרפות עם קוד', // SPEC (shown only when partner sync is on)
  'welcome.demo': 'צפייה בדמו', // SPEC

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
  'error.network': 'אין חיבור לאינטרנט. מנסים שוב כשהחיבור חוזר.',

  'invite.title': 'עכשיו מזמינים את בן או בת הזוג', // SPEC
  'invite.body': 'שולחים את הקישור, ודרכו מצטרפים לקופה הזאת.',
  'invite.codeLabel': 'קוד ההזמנה',
  'invite.share': 'שליחת הזמנה', // SPEC
  'invite.later': 'אעשה את זה אחר כך', // SPEC
  'invite.shareText': 'הצטרפו לקופה המשותפת שלנו: {link}', // SPEC
  'invite.changed': 'קוד ההזמנה התחדש, כדי שהמכשיר הקודם לא יוכל להיכנס. קישור שכבר נשלח לא יעבוד, אז שולחים את החדש.',
  'invite.copied': 'הקישור הועתק. אפשר להדביק אותו בהודעה.',

  'join.title': 'הצטרפות לקופה משותפת',
  'join.code': 'קוד הזמנה', // SPEC
  'join.codeHelp': '6 תווים, מהקישור או מההודעה שקיבלתם',
  'join.rejoinToggle': 'חוזרים ממכשיר אחר?',
  'join.newToggle': 'מצטרפים בפעם הראשונה?',
  'join.personal': 'הקוד האישי שלך',
  'join.personalHelp': 'מופיע בהגדרות במכשיר הקודם. כך חוזרים למקום שלך עם כל ההיסטוריה.',
  'join.personalLength': 'הקוד האישי צריך להיות 12 תווים.',
  'join.personalInvalid': 'הקוד האישי לא מתאים לקופה הזאת. כדאי לבדוק אותו שוב.',
  'join.personalChanged': 'חזרת למקום שלך. הקוד האישי התחלף, והקוד החדש נמצא בהגדרות.',
  'join.rejoinSubmit': 'חזרה לקופה',
  'join.submit': 'הצטרפות',
  'join.codeInvalid': 'הקוד צריך להיות 6 תווים.',
  'join.notFound': 'הקוד לא נמצא. כדאי לבדוק אותו שוב.', // SPEC
  'join.full': 'בקופה הזאת כבר יש שני אנשים.', // SPEC
  'join.already': 'המכשיר הזה כבר מחובר לקופה.', // SPEC
  'join.goHome': 'למסך הבית',
  'join.error': 'לא הצלחנו להצטרף. לנסות שוב?',

  'home.cycleLabel': '{start} עד {end}',
  'home.left': 'נשארו {amount} במחזור הזה', // SPEC
  'home.over': 'חריגה של {amount}', // SPEC
  'home.daysLeft': 'עוד {n} ימים · בערך {amount} ליום', // SPEC
  'home.daysLeftOnly': 'עוד {n} ימים',
  'home.lastDay': 'יום אחרון במחזור', // SPEC
  'home.spentOf': 'הוצאתם {spent} מתוך {budget}', // SPEC
  'home.progress': 'התקציב נוצל ב-{percent}%',
  'home.empty': 'עוד אין הוצאות במחזור הזה. לוחצים על + כדי להוסיף את ההוצאה הראשונה.', // SPEC, wording changed by Asher
  'home.today': 'היום', // SPEC
  'home.yesterday': 'אתמול', // SPEC
  'home.listTitle': 'ההוצאות במחזור',
  'home.add': 'הוספת הוצאה',
  'home.settings': 'הגדרות',
  'home.paidBy': 'שולם על ידי {name}',
  'home.pending': 'ממתין לשליחה',
  'home.loadError': 'לא הצלחנו לטעון את הנתונים.',

  'add.title': 'הוצאה חדשה', // SPEC
  'add.hint': 'מקלידים סכום ובוחרים קטגוריה', // SPEC
  'add.tooMuch': 'אפשר עד {max}',
  'add.amount': 'סכום',
  'add.categories': 'קטגוריה',
  'add.date': 'תאריך ההוצאה',
  'add.dateToday': 'היום',
  'add.dateYesterday': 'אתמול',
  'add.dateOther': 'תאריך אחר',
  'key.backspace': 'מחיקת ספרה',
  'key.dot': 'נקודה עשרונית',

  'toast.saved': 'נשמר ✓', // SPEC
  'toast.undo': 'ביטול', // SPEC
  'toast.undone': 'ההוצאה בוטלה',
  'toast.updated': 'השינויים נשמרו',
  'toast.updatedEarlierCycle': 'השינויים נשמרו. ההוצאה עברה למחזור קודם.',
  'toast.inEarlierCycle': 'במחזור קודם',
  'toast.deleted': 'ההוצאה נמחקה',
  'toast.goneElsewhere': 'ההוצאה הזאת נמחקה במקום אחר',
  'toast.leftCycle': 'ההוצאה הזאת כבר לא במחזור הנוכחי',
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
  'edit.offline': 'עריכה ומחיקה זמינות כשיש חיבור.',
  'edit.pending': 'ההוצאה הזאת עוד לא נשלחה. אפשר לערוך אותה אחרי שתישלח.',

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
  'settings.exportEvents': 'הורדת נתוני שימוש (CSV)',
  'settings.exportExpensesHelp': 'כל ההוצאות שנרשמו, כולל מה שנמחק',
  'settings.exportEventsHelp': 'מי השתמש, מתי ואיך. בלי סכומים',
  'settings.demo': 'מצב הדגמה',
  'settings.resetDemo': 'איפוס הדמו',
  'settings.resetDemoDone': 'הדמו חזר להתחלה',
  'settings.exitDemo': 'יציאה מהדמו',
  'settings.danger': 'ניתוק',
  'settings.disconnect': 'ניתוק המכשיר הזה',
  'settings.disconnectWarnLocal':
    'כל ההוצאות שנשמרו במכשיר הזה יימחקו, ואי אפשר יהיה לשחזר אותן. כדאי להוריד אותן קודם כקובץ CSV.',
  'settings.disconnectYes': 'כן, לנתק ולמחוק',
  'settings.invite': 'הזמנה לקופה',
  'settings.disconnectWarn': 'כדאי לשמור את קוד ההזמנה לפני. בלעדיו אי אפשר לחזור.', // SPEC
  'settings.personalLabel': 'הקוד האישי שלך',
  'settings.inviteHelp': 'שומרים אותו כדי לחזור לקופה ממכשיר אחר.',
  'settings.inviteHelpOpen': 'בן או בת הזוג מצטרפים לקופה עם הקוד הזה. שומרים אותו גם כדי לחזור ממכשיר אחר.',
  'settings.copyInvite': 'העתקת קוד ההזמנה',
  'settings.copyPersonal': 'העתקת הקוד האישי',
  'settings.personalHelp':
    'שומרים אותו יחד עם קוד ההזמנה. שניהם יחד מחזירים אותך למקום שלך ממכשיר אחר. אחרי כל שימוש הקוד מתחלף, והחדש מופיע כאן.',
  'settings.personalWaiting': 'הקוד האישי עוד לא נטען, ובלעדיו אי אפשר לחזור. צריך חיבור כדי לראות אותו לפני הניתוק.',
  'settings.disconnectSyncYes': 'כן, לנתק',
  'settings.disconnectPending': 'יש הוצאות שעוד לא נשלחו. מתחברים לאינטרנט ומנסים שוב, כדי שהן לא יאבדו.',

  'demo.banner': 'מצב הדגמה', // SPEC
  'offline.banner': 'אין חיבור. הוצאות חדשות יישלחו כשהחיבור יחזור.', // SPEC
} as const

export type MessageKey = keyof typeof he
