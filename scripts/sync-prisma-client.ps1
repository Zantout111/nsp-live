# مزامنة المخطط + توليد عميل Prisma.
# إذا ظهر EPERM عند prisma generate: أوقف خادم التطوير (Ctrl+C) ثم أعد تشغيل هذا السكربت.
# اختياري: فك السطر التالي لإنهاء كل عمليات node قبل الحذف (يغلق أيضاً أدوات تعتمد على node):
# Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

if (Test-Path .next) {
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
}

npx prisma db push
npx prisma generate

Write-Host 'Done: prisma db push + prisma generate'
