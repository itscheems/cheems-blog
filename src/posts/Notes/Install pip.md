---
title: How to Install and Use pip?

date: 2025-04-01

tag: 
  - Python

star: false

sticky: false

excerpt: <p> </p>
---

## Install pip

Run the following command to install pip:
``` bash
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py

python3 get-pip.py
```

​​Verify pip is now available​​:
``` bash
pip --version
```

## Check the global installation path of pip packages

Run the following command to check the global installation path of pip packages:
``` bash
python3 -m site --user-site
```

Or just list all globally installed packages directly:
``` bash
pip list --format=columns
```

## Install packages from requirements.txt

``` bash
python3 -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```

## Install packages from requirements.txt with a trusted host

If you meet the following error, you can try to add `--trusted-host pypi.tuna.tsinghua.edu.cn` to the command:
```
WARNING: Retrying (Retry(total=4, connect=None, read=None, redirect=None, status=None)) after connection broken by 'SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1006)'))': /simple/jsonschema/
```

(Recommended)
``` bash
# Download the certificate
curl -O https://pypi.tuna.tsinghua.edu.cn/static/root-ca.pem

# Install it (macOS/Linux)
sudo cp root-ca.pem /usr/local/share/ca-certificates/tuna-root-ca.crt
sudo update-ca-certificates

# Or tell pip to use it
python3 -m pip config set global.cert /path/to/root-ca.pem
```

(Not Recommended)​
``` bash
python3 -m pip install --trusted-host pypi.tuna.tsinghua.edu.cn -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```
