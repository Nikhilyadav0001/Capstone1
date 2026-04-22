pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        //SETUP ENVIROMENT
        stage('Setup Environment') {
            steps {
                bat 'npm install'
            }
        }
        //remove previous and build new Contaner 
        stage('Build & Deploy') {
            environment {
                // These should be configured in Jenkins Credentials
                GEMINI_API_KEY = credentials('GEMINI_API_KEY')
                UNSPLASH_ACCESS_KEY = credentials('UNSPLASH_ACCESS_KEY')
                GOOGLE_CLIENT_ID = credentials('GOOGLE_CLIENT_ID')
                GOOGLE_CLIENT_SECRET = credentials('GOOGLE_CLIENT_SECRET')
                SESSION_SECRET = 'your-session-secret-here'
            }
            steps {
                bat '''
                docker-compose down --remove-orphans || exit 0
                docker-compose up -d --build
                '''
            }
        }
        //heath check
        stage('Health Check') {
            steps {
                bat 'ping 127.0.0.1 -n 11 > nul'
                bat 'curl -f http://localhost:3000/health || exit 1'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}