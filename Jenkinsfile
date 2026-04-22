pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup Environment') {
            steps {
                bat 'npm install'
            }
        }

        stage('Build & Deploy') {
            steps {
                bat '''
                echo Using .env file from Jenkins workspace...

                docker-compose down --remove-orphans || exit 0
                docker-compose --env-file .env up -d --build
                '''
            }
        }

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