$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($historyYear in 2018, 2022) {
  $historyZip = [System.IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) "data/history/$historyYear.zip"))
  try {
    $historyEntry = $historyZip.GetEntry("votacao_candidato_munzona_${historyYear}_BR.csv")
    if ($null -eq $historyEntry) { throw 'Arquivo presidencial BR ausente' }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($historyEntry, (Join-Path (Get-Location) "data/history/$historyYear-BR.csv"), $false)
  } finally { $historyZip.Dispose() }
}
