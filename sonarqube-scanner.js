import {customScanner } from 'sonarqube-scanner';

const sonarqubeUrl = process.env.SONARQUBE_URL;
const sonarqubeToken = 'sqp_d49bc778da88c1319a17c02f1f4a508eb4292392';

(function () {
    customScanner({
        serverUrl: sonarqubeUrl,
        token: sonarqubeToken,
        options: {
            'sonar.projectName': 'backend',
            'sonar.projectDescription': '',
            'sonar.sources': './src',
            'sonar.tests': './test',
            'sonar.host.url': 'http://localhost:9000/',
        },
    }, (error) => {
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('SonarQube scan completed successfully.');
        }
        process.exit();
    })
})()