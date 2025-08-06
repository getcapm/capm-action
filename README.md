# CAPM GitHub Action

<div align="center">

![Logo](docs/logo.png)

</div>

<div align="center">

  *Code Analysis Package Manager 📦*

</div>

<div align="center">

[![main](https://github.com/getcapm/capm-action/actions/workflows/main.yml/badge.svg)](https://github.com/getcapm/capm-action/actions/workflows/main.yml)

</div>

To run CAPM on every push and before every merge to main, append it to your GH
Action workflow:

```yaml
name: 'main'

on:
  push:
    branches: 
      - main
  pull_request:
    branches: 
      - main

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout sources
        uses: actions/checkout@v4

      - name: Run CAPM
        uses: getcapm/capm-action@v1
```

## Inputs

* `capm_version`:
  - Desciption: CAPM version
  - Required: false 
  - Default: 'latest'
