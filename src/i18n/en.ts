// English copy (SPEC section 9, P2). Same keys as he.ts; TypeScript refuses a missing one.
// Keys marked "SPEC" are fixed by SPEC.md section 9.

import type { MessageKey } from './he.ts'

export const en: Record<MessageKey, string> = {
  'app.footer': '{name} · version {version} · course project MVP',
  'app.copyright': '© {year} {owner}. All rights reserved.',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.copied': 'Code copied',
  'common.copyFailed': "Couldn't copy. You can select the code and copy it.",

  'welcome.tagline': "Always know what's left until the next card bill", // SPEC
  'welcome.create': 'Start a shared budget', // SPEC
  'welcome.join': 'Join with a code', // SPEC
  'welcome.demo': 'Try the demo', // SPEC

  'create.title': 'Start a shared budget',
  'create.name': "What's your name?", // SPEC
  'create.budget': 'How much do you want to spend per cycle?', // SPEC
  'create.budgetPlaceholder': 'For example 9000',
  'create.cycleDay': 'Which day does your cycle start?', // SPEC
  'create.cycleHelp': 'Most people pick their credit card charge day. You can change it later.', // SPEC
  'create.dayOption': 'Day {day}',
  'create.submit': 'Create',
  'create.nameRequired': 'Please enter a name.',
  'create.budgetInvalid': 'Type an amount above zero and up to {max}.',
  'create.error': "Couldn't create the budget. Try again?",
  'error.network': "No internet connection. We'll try again when you're back online.",

  'invite.title': 'Now invite your partner', // SPEC
  'invite.body': 'Send the link, and your partner joins this budget through it.',
  'invite.codeLabel': 'Invite code',
  'invite.share': 'Send invite', // SPEC
  'invite.later': "I'll do it later", // SPEC
  'invite.shareText': 'Join our shared budget: {link}', // SPEC
  'invite.changed': "The invite code changed, so the old device can't get in. A link you already sent won't work, so send the new one.",
  'invite.copied': 'Link copied. You can paste it in a message.',

  'join.title': 'Join a shared budget',
  'join.code': 'Invite code', // SPEC
  'join.codeHelp': '6 characters, from the link or the message you got',
  'join.rejoinToggle': 'Coming back from another device?',
  'join.newToggle': 'Joining for the first time?',
  'join.personal': 'Your personal code',
  'join.personalHelp': 'Shown in Settings on your old device. It brings you back to your place with all your history.',
  'join.personalLength': 'The personal code has 12 characters.',
  'join.personalInvalid': "This personal code doesn't match this budget. Please check it.",
  'join.personalChanged': "You're back in your place. Your personal code changed, and the new one is in Settings.",
  'join.rejoinSubmit': 'Back to the budget',
  'join.submit': 'Join',
  'join.codeInvalid': 'The code has 6 characters.',
  'join.notFound': 'Code not found. Please check it.', // SPEC
  'join.full': 'This budget already has two people.', // SPEC
  'join.already': 'This device is already connected to a budget.', // SPEC
  'join.goHome': 'Go to home',
  'join.error': "Couldn't join. Try again?",

  'home.cycleLabel': '{start} to {end}',
  'home.left': '{amount} left this cycle', // SPEC
  'home.over': '{amount} over budget', // SPEC
  'home.daysLeft': '{n} days left · about {amount} per day', // SPEC
  'home.daysLeftOnly': '{n} days left',
  'home.lastDay': 'Last day of the cycle', // SPEC
  'home.leftPast': '{amount} left at the end of the cycle',
  'home.cycleEnded': 'This cycle has ended',
  'home.emptyPast': 'No expenses were logged in this cycle.',
  'home.prevCycle': 'Previous cycle',
  'home.nextCycle': 'Next cycle',
  'home.backToCurrent': 'Back to current cycle', // SPEC
  'home.spentOf': 'Spent {spent} of {budget}', // SPEC
  'home.progress': 'Budget {percent}% used',
  'home.empty': 'No expenses this cycle yet. Tap + to add the first one.', // SPEC
  'home.today': 'Today', // SPEC
  'home.yesterday': 'Yesterday', // SPEC
  'home.listTitle': 'Expenses this cycle',
  'home.add': 'Add expense',
  'home.settings': 'Settings',
  'home.paidBy': 'Paid by {name}',
  'home.pending': 'Waiting to sync',
  'home.loadError': "Couldn't load the data.",

  'add.title': 'New expense', // SPEC
  'add.hint': 'Type an amount, then pick a category', // SPEC
  'add.tooMuch': 'Up to {max}',
  'add.amount': 'Amount',
  'add.categories': 'Category',
  'add.date': 'Date of the expense',
  'add.dateToday': 'Today',
  'add.dateYesterday': 'Yesterday',
  'add.dateOther': 'Other date',
  'key.backspace': 'Delete digit',
  'key.dot': 'Decimal point',

  'toast.saved': 'Saved ✓', // SPEC
  'toast.undo': 'Undo', // SPEC
  'toast.undone': 'Expense removed',
  'toast.updated': 'Changes saved',
  'toast.updatedEarlierCycle': 'Changes saved. The expense moved to an earlier cycle.',
  'toast.updatedOtherCycle': 'Changes saved. The expense moved to another cycle.',
  'toast.inEarlierCycle': 'in an earlier cycle',
  'toast.deleted': 'Expense deleted',
  'toast.goneElsewhere': 'This expense was deleted on another device',
  'toast.leftCycle': 'This expense is no longer in this cycle',
  'toast.actionFailed': 'Something went wrong. Try again?',

  'error.save': "Couldn't save. Try again?", // SPEC
  'error.title': 'Something went wrong',
  'error.body': 'Your data is saved on this device. You can try again.',

  'edit.title': 'Edit expense',
  'edit.date': 'Date',
  'edit.dateInvalid': 'Pick a date within the last year, not in the future.',
  'edit.paidBy': 'Paid by',
  'edit.save': 'Save',
  'edit.delete': 'Delete', // SPEC
  'edit.deleteConfirm': 'Delete this expense?', // SPEC
  'edit.deleteYes': 'Yes, delete',
  'edit.offline': 'Editing and deleting work when you are online.',
  'edit.pending': "This expense hasn't synced yet. You can edit it once it has.",

  'settings.title': 'Settings',
  'settings.members': "Who's in the budget",
  'settings.thisDevice': 'This device',
  'settings.editName': 'Edit name',
  'settings.yourName': 'Your name',
  'settings.budgetSection': 'Budget and cycle',
  'settings.budget': 'Budget per cycle',
  'settings.cycleDay': 'Cycle start day',
  'settings.cycleHelp': 'Changes apply right away to the current cycle.', // SPEC
  'settings.saved': 'Saved',
  'settings.language': 'Language',
  'settings.theme': 'Appearance',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.themeSystem': 'Same as device',
  'settings.export': 'Export data',
  'settings.exportExpenses': 'Download expenses (CSV)',
  'settings.exportEvents': 'Download usage data (CSV)',
  'settings.exportExpensesHelp': 'Every expense logged, including deleted ones',
  'settings.exportEventsHelp': 'Who used the app, when and how. No amounts',
  'settings.demo': 'Demo mode',
  'settings.resetDemo': 'Reset demo',
  'settings.resetDemoDone': 'The demo is back to the start',
  'settings.exitDemo': 'Exit demo',
  'settings.simulatePartner': 'Simulate partner expense',
  'settings.simulatePartnerSoon': 'In 3 seconds, an expense from your partner arrives',
  'settings.danger': 'Disconnect',
  'settings.disconnect': 'Disconnect this device',
  'settings.disconnectWarnLocal':
    'All expenses saved on this device will be deleted and cannot be restored. Download them as a CSV file first.',
  'settings.disconnectYes': 'Yes, disconnect and delete',
  'settings.invite': 'Invite to the budget',
  'settings.disconnectWarn': "Save your invite code first. Without it you can't get back.", // SPEC
  'settings.personalLabel': 'Your personal code',
  'settings.inviteHelp': 'Keep it to get back to the budget from another device.',
  'settings.inviteHelpOpen': 'Your partner joins the budget with this code. Keep it also to get back from another device.',
  'settings.copyInvite': 'Copy invite code',
  'settings.copyPersonal': 'Copy personal code',
  'settings.personalHelp':
    'Keep it with the invite code. Together they bring you back to your place from another device. The code changes after each use, and the new one shows here.',
  'settings.personalWaiting':
    "Your personal code hasn't loaded yet, and without it you can't get back. Connect to the internet to see it before you disconnect.",
  'settings.disconnectSyncYes': 'Yes, disconnect',
  'settings.disconnectPending': "Some expenses haven't synced yet. Connect to the internet and try again, so they aren't lost.",

  'demo.banner': 'Demo mode', // SPEC
  'offline.banner': "You're offline. New expenses will sync when you're back online.", // SPEC
}
