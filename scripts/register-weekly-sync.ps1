$taskName = "Content OS Daily Sync"
$projectPath = Split-Path -Parent $PSScriptRoot
$npmPath = (Get-Command npm.cmd).Source
$action = New-ScheduledTaskAction -Execute $npmPath -Argument "run sync:run" -WorkingDirectory $projectPath
$trigger = New-ScheduledTaskTrigger -Daily -At 11:00PM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Daily Content OS sync for Instagram and TikTok at 23:00 ART." `
  -Force

Write-Host "Scheduled task '$taskName' created."
