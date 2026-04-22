pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // Install dependencies
        stage('Setup Environment') {
            steps {
                bat 'npm install'
            }
        }

        // Copy .env + Build & Deploy
        stage('Build & Deploy') {
            steps {
                bat '''
                echo ===============================
                echo Copying .env file...
                echo ===============================

                copy loginpage\\loginpage\\.env .env

                echo ===============================
                echo Starting Docker...
                echo ===============================

                docker-compose down --remove-orphans || exit 0
                docker-compose --env-file .env up -d --build
                '''
            }
        }

        // Health check
        stage('Health Check') {
            steps {
                bat 'ping 127.0.0.1 -n 10 > nul'
                bat 'curl -f http://localhost:3000/health || exit 1'
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}