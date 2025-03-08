# GitHub Actions Workflow Documentation

## Table of Contents
- [Overview](#overview)
- [Workflow Structure](#workflow-structure)
- [YAML Syntax Details](#yaml-syntax-details)
- [Components Breakdown](#components-breakdown)
- [Environment and Secrets](#environment-and-secrets)
- [Best Practices](#best-practices)

## Overview
This document explains the syntax and structure of the GitHub Actions workflow used for Docker CI/CD in the PCMS Frontend project.

## Workflow Structure

### Workflow Triggers
```yaml
on:
  push:
    branches: [ main ]
    tags: [ 'v*.*.*' ]
  pull_request:
    branches: [ main ]
```
- Workflow runs on:
  - Push to main branch
  - Tags matching v*.*.* pattern
  - Pull requests to main branch

### Environment Setup
```yaml
env:
  REGISTRY: ghcr.io
```
Defines GitHub Container Registry URL globally

## YAML Syntax Details

### Basic Concepts
1. **Indentation**
   - Uses spaces (not tabs)
   - Typically 2 spaces per level
   - Shows hierarchy and relationships

2. **Key-Value Pairs**
```yaml
name: Docker CI/CD
env:
  REGISTRY: ghcr.io
```

3. **Lists/Arrays**
```yaml
branches: [ main ]  # Inline array
steps:              # Multi-line array
  - uses: actions/checkout@v3
  - uses: actions/setup-node@v2
```

## Components Breakdown

### 1. Job Configuration
```yaml
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
```

### 2. Steps Configuration
- **Checkout Code**
```yaml
- uses: actions/checkout@v3
```

- **Setup Node.js**
```yaml
- uses: actions/setup-node@v2
  with:
    node-version: '22'
```

- **Docker Setup**
```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v2

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2
```

### 3. Image Building and Publishing
```yaml
- name: Build and push
  uses: docker/build-push-action@v4
  with:
    context: .
    file: ./docker/prod/Dockerfile
    push: true
    tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
```

## Environment and Secrets

### 1. Environment Variables
```yaml
env:
  REGISTRY: ghcr.io
```

### 2. GitHub Secrets Usage
```yaml
password: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Dynamic Variables
```yaml
echo "IMAGE_NAME=$(echo ${{ github.repository }} | tr '[:upper:]' '[:lower:]')" >> $GITHUB_ENV
```

## Best Practices

1. **Security**
   - Use secrets for sensitive data
   - Set minimum required permissions
   - Use specific version tags for actions

2. **Maintenance**
   - Keep workflow files modular
   - Document complex steps
   - Use meaningful step names

3. **Performance**
   - Use caching when possible
   - Minimize the number of steps
   - Use efficient Docker build strategies

## Common Issues and Solutions

1. **Case Sensitivity**
   - Always use lowercase for Docker image names
   - Convert repository names to lowercase

2. **Permissions**
   - Ensure proper GITHUB_TOKEN permissions
   - Set explicit permissions in workflow

3. **Version Control**
   - Use specific versions for actions
   - Test workflow changes in branches

---

*Generated for PCMS Frontend Project - Last Updated: March 2024*