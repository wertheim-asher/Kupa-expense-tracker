# Kupa pilot (October 4 to 16, 2026)

Goal: real numbers for the presentation on October 18. A few couples use Kupa for about 10 days,
then one query gives the numbers for the three assumptions in SPEC.md.

## Timeline
| When | What |
|---|---|
| Sat Oct 3 to Sun Oct 4 | Send the invite below to 3 to 6 couples. Ask each couple to reply "started". |
| Thu Oct 8 | A short check-in message: "Still logging? Anything annoying?" |
| Fri Oct 16 | Send the 3 closing questions. Run `metrics.sql` (below) and save the result. |
| Sat Oct 17 | Put the numbers and 2 or 3 quotes on slides. |

## The invite (WhatsApp)
```
היי, אני בונה את "קופה" לפרויקט הגמר שלי בקורס ניהול מוצר. זו אפליקציה לזוגות שמראה תמיד כמה נשאר בתקציב עד החיוב הבא בכרטיס.
אשמח אם תנסו אותה יחד עד יום שישי, 16 באוקטובר:
1. פותחים את הקישור: https://kupa-expense-tracker.netlify.app
2. לוחצים "פתיחת קופה משותפת", כותבים שם (אפשר כינוי), תקציב חודשי ואת היום שבו מתחיל המחזור של הכרטיס.
3. לוחצים "שליחת הזמנה" ושולחים לבן או לבת הזוג.
4. רושמים כל הוצאה, בכרטיס או במזומן: לוחצים +, מקלידים סכום ובוחרים קטגוריה. זהו.
טיפ: כדאי להוסיף את האפליקציה למסך הבית (בתפריט של הדפדפן).
אין חיבור לבנק ואין הרשמה. לפרויקט אני משתמש רק בנתוני שימוש (כמה זמן לוקח לרשום וכמה פעמים), בלי סכומים ובלי שמות.
בסוף אשאל 3 שאלות קצרות. תודה!
```
The invite promises that only usage data is used, without amounts or names. Keep that promise:
`metrics.sql` reads only counts and times.

## The 3 closing questions (October 16)
```
תודה שניסיתם את קופה. 3 שאלות קצרות:
1. מ-1 עד 5, כמה קל היה לרשום הוצאה?
2. כמה פעמים בשבוע הסתכלתם על "כמה נשאר"?
3. הייתם ממשיכים להשתמש בה? למה כן או למה לא?
```

## Running the numbers (October 16)
1. Open the Supabase dashboard, project `xblsobdgqmwvnbdhowiq`.
2. SQL Editor, New query. Paste all of `metrics.sql`.
3. In `params` at the top, check the start date (the day you sent the invites). The invite code of your
   own budget (TRRYBE) is already there, so your own budget counts too.
4. Run. One table appears: copy it, or take a screenshot, and send it to Claude for the slides.

What the rows mean:
| Rows | Assumption (SPEC.md) | A good sign |
|---|---|---|
| A1 speed | People log every expense if it takes about 5 seconds | Median about 5 s or less; few "closed without saving" |
| A2 habit | Seeing "left this cycle" is enough reason to keep logging | Logging on most days; people still logging in the last 3 days |
| A3 cycle | A billing-cycle budget matters more than a calendar month | Many budgets start on a day other than the 1st |

Test data (`rls-test-…` budgets) is left out automatically.
