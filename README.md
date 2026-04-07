# LinkedIn Post Extractor Extension

Chrome extension built to retrieve LinkedIn post data from company and individual profiles using LinkedIn Voyager endpoints.

**Created:** 2023

## Overview

This project is a Chrome extension for extracting LinkedIn post data from personal and company-related profile activity. It combines a lightweight extension interface with requests to LinkedIn Voyager endpoints to retrieve profile and post information.

The repository also includes a Postman collection used to test and inspect Voyager API endpoints during development.

## Features

- Retrieve LinkedIn profile data
- Extract post data from individual profiles
- Query LinkedIn activity endpoints
- Test Voyager API requests with Postman
- Use a simple extension UI built with HTML, CSS, and JavaScript

## Tech Stack

- JavaScript
- HTML
- CSS
- Chrome Extension APIs
- Postman

## API Endpoints Tested

The Postman collection includes requests for:

- `/voyager/api/me`
- `/voyager/api/identity/profiles/:profile`
- `/voyager/api/feed/social/:activityUrn`
- `/voyager/api/identity/profileUpdatesV2`

## Project Structure

```text
LIextension/
├── extension.html
├── extension.css
├── popup.js
├── manifest.json
├── hello_extensions.png
└── Postman/
