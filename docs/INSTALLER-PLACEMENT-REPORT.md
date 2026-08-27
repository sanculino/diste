# PM Web Agent — Local Installer Placement Report

**Date:** 2026-08-27 (post-LOCALAPPDATA fix rebuild)  
**Action:** Replace Azure-signed Setup.exe in site project (local only)  
**Production modified:** NO  
**Commit / deploy / VPS:** NO  

## Superseded builds

Installer hashes from the **2026-08-27 morning** build (pre-LOCALAPPDATA fix) are **OBSOLETE**.  
See git history / prior version of this file for audit trail only.

## Source (unchanged in webagent\release)

| Edition | Path |
|---------|------|
| DEMO | `webagent\release\DEMO\PMWebAgent_DEMO_Setup.exe` |
| 1PC | `webagent\release\1PC\PMWebAgent_1PC_Setup.exe` |
| 3PC | `webagent\release\3PC\PMWebAgent_3PC_Setup.exe` |

## Destination (site project)

| Edition | Path | Access |
|---------|------|--------|
| DEMO | `distemanagement\public\downloads\PMWebAgent_DEMO_Setup.exe` | PUBLIC |
| 1PC | `distemanagement\private\downloads\PMWebAgent_1PC_Setup.exe` | PROTECTED |
| 3PC | `distemanagement\private\downloads\PMWebAgent_3PC_Setup.exe` | PROTECTED |

## SHA-256 (full file content — Get-FileHash)

| File | SHA-256 |
|------|---------|
| PMWebAgent_DEMO_Setup.exe | `25797B0F01437CAA193A1B4B5FAAB056F1DBB3AF6D931857CE574CA71FB5891C` |
| PMWebAgent_1PC_Setup.exe | `9E3932580AACBB2203CBD79A87983A9F0795059E4FF9D2D8E7DE45B08E7267C0` |
| PMWebAgent_3PC_Setup.exe | `C5D697F35AFD11E22387E29489ADE7ACBFF4472D9BB0B221DA1F7C6B3F04A00E` |

## Sizes / build timestamps

| File | Bytes | LastWriteTime |
|------|------:|---------------|
| DEMO Setup | 390103000 | 2026-08-27 13:27:03 |
| 1PC Setup | 390106872 | 2026-08-27 13:27:12 |
| 3PC Setup | 390106496 | 2026-08-27 13:27:21 |

## Signature

- Azure signed = **YES**  
- publisher = **diste management sas**  
- signtool verify /pa on all three destination copies: Successfully verified, **0 warnings**, **0 errors**  
- Post-LOCALAPPDATA fix build = **YES**

## Authenticode digests (signtool — not full-file SHA256)

| File | Authenticode hash |
|------|-------------------|
| DEMO | `7129191680E348D5EB1D42F676F1C78B718666BAAF8FBD66FE85ACB3D5670C75` |
| 1PC | `FFB17AE787A24631036540746BB16147601C50C5849CE6EF7D59BEEB0437DD58` |
| 3PC | `0D13D4D0D22CB3B336740E431265B505059261D7EEFD78A7A41F576B13F55138` |

## Verification performed

- Source ↔ destination full-file SHA-256 match: **PASS** (all three)  
- No duplicate `PMWebAgent_*_Setup.exe` outside expected paths  
- No `PMWebAgent_1PC` / `PMWebAgent_3PC` under `public/`  
- Legacy `PalermoBusinessAgent_Setup_*.zip` still under `public/downloads/` — retire at deploy  
