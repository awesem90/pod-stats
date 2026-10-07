# Converts a BG Stats export (BGStatsExport.json) into data/pod.json for the site.
#
#   powershell -ExecutionPolicy Bypass -File tools\import-bgstats.ps1 -Export "C:\Users\sem_m\Downloads\BGStatsExport.json"
#
# Keeps only Magic: The Gathering plays that have commanders (Draft games are skipped), and looks up
# every commander and Card of the Match on Scryfall once, so the site needs no API calls at runtime.
# Free-text comments are not published; only a "Cotm: <card>" line is read from them.
param(
  [Parameter(Mandatory = $true)][string]$Export,
  [string]$Out = '',
  [int]$BggId = 463
)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is not available inside param() defaults in Windows PowerShell 5.1.
if (-not $Out) { $Out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\data\pod.json' }
$utf8 = New-Object System.Text.UTF8Encoding $false

$j = [IO.File]::ReadAllText((Resolve-Path $Export), $utf8) | ConvertFrom-Json
$game = $j.games | Where-Object { $_.bggId -eq $BggId } | Select-Object -First 1
if (-not $game) { throw "No game with BGG id $BggId in the export." }

$players = @{}; $j.players | ForEach-Object { $players[[int]$_.id] = $_.name }
$locations = @{}; $j.locations | ForEach-Object { $locations[[int]$_.id] = $_.name }

# "A & B" and "A with Background" are two cards; everything else is one card name.
function Split-Commander([string]$role) { @($role -split '\s+&\s+|\s+with\s+' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }

$plays = @()
foreach ($p in ($j.plays | Where-Object { $_.gameRefId -eq $game.id -and -not $_.ignored } | Sort-Object playDate)) {
  $seats = @($p.playerScores)
  if (-not ($seats | Where-Object { $_.role })) { continue }   # Draft and other games without commanders
  $cotm = $null
  if ($p.comments -match '(?im)^\s*cotm\s*:\s*(.+?)\s*$') { $cotm = $Matches[1] }
  $plays += [ordered]@{
    id       = $p.uuid
    date     = $p.playDate.Substring(0, 10)
    time     = $p.playDate.Substring(11, 5)
    minutes  = $(if ($p.durationMin -gt 0) { [int]$p.durationMin } else { $null })
    rounds   = $(if ($p.rounds -gt 0) { [int]$p.rounds } else { $null })
    location = $locations[[int]$p.locationRefId]
    card     = $cotm
    seats    = @($seats | ForEach-Object {
      [ordered]@{
        player     = $players[[int]$_.playerRefId]
        commanders = @(Split-Commander $_.role)
        win        = [bool]$_.winner
        starter    = [bool]$_.startPlayer
      }
    })
  }
}

# ---------- Scryfall: one lookup per card name, reusing the previous run's results ----------
$cards = [ordered]@{}
if (Test-Path $Out) {
  $old = [IO.File]::ReadAllText((Resolve-Path $Out), $utf8) | ConvertFrom-Json
  if ($old.cards) { $old.cards.PSObject.Properties | ForEach-Object { $cards[$_.Name] = $_.Value } }
}
function Card-Info($c) {
  $face = if ($c.image_uris) { $c } else { $c.card_faces[0] }
  [ordered]@{
    name   = ($c.name -split ' // ')[0]
    colors = @('W','U','B','R','G' | Where-Object { $c.color_identity -contains $_ })
    art    = $face.image_uris.art_crop
    image  = $face.image_uris.normal
    artist = $(if ($face.artist) { $face.artist } else { $c.artist })
    uri    = $c.scryfall_uri
  }
}
$headers = @{ 'User-Agent' = 'PodStats/1.0'; 'Accept' = 'application/json' }
$wanted = @($plays | ForEach-Object { $_.seats | ForEach-Object { $_.commanders } }) + @($plays | ForEach-Object { $_.card } | Where-Object { $_ })
$missing = @($wanted | Sort-Object -Unique | Where-Object { -not $cards.Contains($_.ToLower()) })

for ($i = 0; $i -lt $missing.Count; $i += 75) {
  $batch = $missing[$i..([Math]::Min($i + 74, $missing.Count - 1))]
  $body = @{ identifiers = @($batch | ForEach-Object { @{ name = $_ } }) } | ConvertTo-Json -Depth 4
  $res = Invoke-RestMethod -Method Post -Uri 'https://api.scryfall.com/cards/collection' -Headers $headers -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body))
  $byName = @{}
  foreach ($c in $res.data) { $info = Card-Info $c; $byName[$c.name.ToLower()] = $info; $byName[$info.name.ToLower()] = $info }
  foreach ($n in $batch) { if ($byName[$n.ToLower()]) { $cards[$n.ToLower()] = $byName[$n.ToLower()] } }
  Start-Sleep -Milliseconds 150
}
# Informal names ("rhystic study", "Satya") get a fuzzy match; ambiguous ones stay unmatched.
foreach ($n in @($missing | Where-Object { -not $cards.Contains($_.ToLower()) })) {
  try {
    $c = Invoke-RestMethod -Uri ('https://api.scryfall.com/cards/named?fuzzy=' + [Uri]::EscapeDataString($n)) -Headers $headers
    $cards[$n.ToLower()] = Card-Info $c
  } catch { Write-Warning "Scryfall found no single card for '$n'" }
  Start-Sleep -Milliseconds 150
}

$data = [ordered]@{
  generated = (Get-Date).ToString('yyyy-MM-dd HH:mm')
  game      = $game.name
  plays     = $plays
  cards     = $cards
}
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject $data -Depth 8 -Compress), $utf8)
"Wrote {0} plays and {1} cards to {2}" -f $plays.Count, $cards.Count, (Resolve-Path $Out)
