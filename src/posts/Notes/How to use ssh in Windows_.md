---
title: How to use SSH in Windows?

# icon: pen-to-square
date: 2025-04-20
# category:
#   - 无
tag: 
  - install

# 摘要
excerpt: <p>ssh tutorial for Windows.</p>
---

If you server is running Windows, you can use ssh to connect to it.

## Step 1. Install OpenSSH Server

Open your PowerShell and type:
```powershell
# check sshd service status
Get-Service sshd
```

If you see the following output, it means you haven't installed sshd.
```
PS C:\Users\Administrator> Get-Service sshd

Get-Service : 找不到任何服务名称为“sshd”的服务。
所在位置 行:1 字符: 1
+ Get-Service sshd
+ ~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (sshd:String) [Get-Service], ServiceCommandException
    + FullyQualifiedErrorId : NoServiceFoundForGivenName,Microsoft.PowerShell.Commands.GetServiceCommand
```

If you haven't installed sshd, you can install it by typing:
```powershell
# install OpenSSH Server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

## Step 2. Start sshd Service

Open your PowerShell and type:
```powershell
# check sshd service status
Get-Service sshd

# start sshd service
Start-Service sshd

# check sshd service status again
Get-Service sshd
```

If you see the following output, it means sshd service is running.
```
administrator@PC-xxx C:\Users\Administrator>powershell
Windows PowerShell                                
版权所有 (C) Microsoft Corporation。保留所有权利。
                                                  
尝试新的跨平台 PowerShell https://aka.ms/pscore6  

PS C:\Users\Administrator> Get-Service sshd

Status   Name               DisplayName                           
------   ----               -----------                           
Running  sshd               OpenSSH SSH Server
```

If you want to start sshd service automatically, you can run the following command:
```powershell
Set-Service sshd -StartupType Automatic
```

## Step 3. Connect to Server

Open your CMD and run the following command (Execute it on another computer...)
```bash
# example: ssh mike@192.0.10.2
ssh username@ip_address
```

You can see the following output:
```
jojo@jojodeMacBook-Pro cjj_project % ssh Administrator@192.168.1.7    
Administrator@192.168.1.7's password:

Microsoft Windows [版本 10.0.19045.5737]
(c) Microsoft Corporation。保留所有权利。            
                                                     
administrator@PC-xxx C:\Users\Administrator>
administrator@PC-xxx C:\Users\Administrator>
```
