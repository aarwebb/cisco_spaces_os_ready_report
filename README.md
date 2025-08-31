# Cisco Spaces OS Ready Report v2 (API-Powered)

![Cisco Spaces OS Ready Report Logo](OS_Ready_Headline.png)

## Overview

The Cisco Spaces OS Ready Report v2 is a next-generation Chrome extension for generating comprehensive OS readiness reports using direct API calls. It provides fast, reliable, and modular data collection, analysis, and reporting for Cisco Spaces environments.

---

## Extension Flow

1. **Data Gathering**
   - Each check module collects raw data from Cisco Spaces APIs and endpoints.
   - Data is processed into parsedData and stored for analysis.
2. **Data Analysis**
   - The analysis layer extracts insights, recommendations, and status indicators from parsedData.
   - Analysis results are stored and passed to reporting.
3. **Data Reporting**
   - The reporting layer generates dynamic HTML reports, including visual indicators and actionable recommendations.
   - Reports can be exported as PDF, JSON, or raw data.

---


## Development Documentation

- [Data Models Documentation](./README_DATA_MODELS.md)
- [Checks Layer Documentation](./README_CHECKS.md)
- [Analysis Layer Documentation](./README_ANALYSIS.md)
- [Reporting Layer Documentation](./README_REPORTING.md)

---

## Installation & Usage

1. Clone or download this repository.
2. Load the extension in Chrome via `chrome://extensions` (Enable Developer Mode > Load Unpacked).
3. Configure and run the OS Ready checks from the popup UI.
4. View, export, and share reports as needed.

---

## Authors & Contributors

- **Author:** Aaron Webb
- **Contributors:** Simon Light

---

## Features

- Modular architecture for easy extension and maintenance
- API-powered data collection for speed and reliability
- Flexible analysis and reporting with recommendations
- Export options: PDF, JSON, raw data
- Visual indicators and alerting for quick insights

---

## Support & Feedback

For questions, feature requests, or bug reports, please contact the project maintainers or open an issue in this repository.

---

## License

See [LICENSE](./LICENSE) for details.
