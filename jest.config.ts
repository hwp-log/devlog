// Jest 실행 환경 설정 (어떻게 테스트할지)
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    dir: './',
})

const config = {
    testEnvironment: 'jsdom',
    setupFiles: ['<rootDir>/jest.polyfills.ts'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
}

export default createJestConfig(config)
