# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the SGAR Advocacy Tool - a web-based advocacy application that tracks NSW councils' use of Second Generation Anticoagulant Rodenticides (SGARs) and their impact on wildlife. The project consists of two standalone HTML files representing different versions of an interactive dashboard and mapping tool.

## Refactoring Goals
This project is being refactored from monolithic HTML files into a professional web application structure:

### Primary Objectives
1. Extract council data into JSON files
2. Separate HTML, CSS, JavaScript into organized, maintainable files  
3. Maintain all functionality and modern design
4. Create modular, reusable code structure
5. Prepare for deployment as professional advocacy tool

### Refactoring Priority
- **V2.html as master**: Use V2.html as the foundation (modern UI, better UX)
- **Selective integration**: Incorporate best features from V1.html where beneficial
- **Maintain functionality**: Ensure no loss of existing capabilities during refactoring

### Target Architecture
The refactored application should follow modern web development best practices:
#### File Structure (Target)
```
sgar-advocacy-tool/
├── index.html                 # Main entry point
├── assets/
│   ├── css/
│   │   ├── main.css          # Core styles and CSS variables
│   │   ├── components.css    # Component-specific styles
│   │   ├── layout.css        # Layout and responsive design
│   │   └── map.css           # Map-specific styles
│   ├── js/
│   │   ├── main.js           # Application initialization
│   │   ├── sgar-tracker.js   # Main SGARTracker class
│   │   ├── map-controller.js # Map functionality
│   │   ├── ui-controller.js  # UI interactions and events
│   │   └── utils.js          # Utility functions
│   └── images/               # Static assets
├── data/
│   └── councils.json         # Council data (extracted from sgarAuditData)
├── CLAUDE.md                 # Project documentation
└── README.md                 # Project overview and setup
```
#### Modern Web Development Principles
- **Separation of Concerns**: HTML for structure, CSS for presentation, JS for behavior
- **Modular JavaScript**: ES6 modules and classes for maintainable code
- **Semantic HTML**: Clean, accessible markup with proper structure
- **Responsive Design**: Mobile-first approach with modern CSS techniques
- **External Data**: JSON files for data management, not embedded objects
- **CDN Dependencies**: External libraries loaded via CDN with fallback considerations
- **Progressive Enhancement**: Core functionality works without JavaScript
#### Code Organization Standards
- **index.html**: Clean entry point with minimal inline code
- **CSS Architecture**: Organized stylesheets with logical separation
- **JavaScript Modules**: Each file has a single responsibility
- **Data Management**: External JSON files for easy maintenance
- **Asset Organization**: Logical folder structure for scalability

## Architecture

### File Structure
- `V1.html` - Complete Enhanced SGAR Directory (embedded version) - comprehensive list-based interface with statistics dashboard
- `V2.html` - NSW SGAR Wildlife Impact Map - real-time council tracking with interactive map using OpenLayers

### Key Components

#### V1.html (Directory Version)
- **Data Structure**: `sgarAuditData` object containing council information (SGAR usage status, programs, notes, email contacts)
- **Core Functions**:
  - `updateStatsDisplay()` - Updates statistics counters
  - `processSgarData()` - Processes council data for display
  - `renderSgarCards()` - Renders council information cards
- **Features**: Statistics dashboard, searchable council directory, filtering by SGAR status, contact information display

#### V2.html (Map Version)  
- **Main Class**: `SGARTracker` - handles all application logic
- **Data Structure**: `sgarAuditData` transformed into `sgarCouncilData` with regional assignments
- **Core Methods**:
  - `updateStats()` - Calculates and displays statistics
  - `renderCouncils()` - Renders council data in grid/list views  
  - `setupEventListeners()` - Handles UI interactions
  - `getCouncilRegion()` - Assigns councils to geographic regions
- **Dependencies**: OpenLayers v7.1.0 for mapping functionality
- **Features**: Interactive map with markers, progress tracking, animated statistics, council search and filtering

### Data Model
Both versions use the same core data structure with council records containing:
- `sgars`: SGAR usage status ("Yes", "No", "Unknown")
- `programs`: Description of pest control programs
- `notes`: Additional context and policy details
- `email`: Council contact information

### External Dependencies
- OpenLayers v7.1.0 - Primary mapping library
- OpenLayers Extensions v4.0.0 - Additional map controls and styling
- Modern CSS with CSS Grid and Flexbox for responsive layouts
- Vanilla JavaScript (ES6+) - No framework dependencies

## Development Commands

This project uses standalone HTML files with no build system. Development is done by:

1. **Local Development**: Open HTML files directly in a web browser or serve via local HTTP server
2. **Testing**: Manual testing in browser - no automated test suite
3. **No Build Process**: Files are production-ready as-is
4. **No Package Manager**: All dependencies loaded via CDN

## Key Development Notes

- Both files are self-contained with inline CSS and JavaScript
- Council data is embedded directly in JavaScript objects within each file
- Map functionality requires internet connection for OpenLayers CDN and tile services
- Responsive design supports mobile and desktop viewing
- No server-side components - purely client-side application
- Data updates require manual editing of the `sgarAuditData` objects in each file

## Code Conventions

- CSS uses modern features (CSS Grid, Flexbox, CSS Custom Properties)
- JavaScript uses ES6+ features (classes, arrow functions, template literals)
- Consistent naming: kebab-case for CSS, camelCase for JavaScript
- Extensive use of CSS custom properties for theming and consistency
- Semantic HTML structure with proper accessibility considerations