#!/usr/bin/env python3
"""
Render.com Deployment Script for TraceLink OSINT
Deploys the TraceLink application to Render.com using their API

Usage:
    python deploy_to_render.py [--blueprint] [--env-group] [--check]
    
Environment:
    RENDER_API_KEY: Your Render API key (or use the provided key)
    
Author: TraceLink Team
"""

import os
import sys
import json
import argparse
import subprocess
import time
import requests
from pathlib import Path

# Configuration
RENDER_API_KEY = "rnd_QLtQaZmUnzRhFME0eWgJhl3RuBmB"
RENDER_API_BASE = "https://api.render.com/v1"
BLUEPRINT_FILE = "render.yaml"
ENV_GROUP_NAME = "tracelink-secrets"

class RenderDeployer:
    """Handles deployment to Render.com"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def check_connection(self) -> bool:
        """Check if we can connect to Render API"""
        try:
            response = requests.get(
                f"{RENDER_API_BASE}/users/me",
                headers=self.headers,
                timeout=10
            )
            if response.status_code == 200:
                user_data = response.json()
                print(f"✅ Connected to Render as: {user_data.get('email', 'Unknown')}")
                return True
            else:
                print(f"❌ API Error: {response.status_code} - {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def deploy_blueprint(self, blueprint_file: str) -> dict:
        """Deploy using a blueprint file"""
        print(f"\n📦 Deploying blueprint: {blueprint_file}")
        
        # Read blueprint
        blueprint_path = Path(blueprint_file)
        if not blueprint_path.exists():
            return {"error": f"Blueprint file not found: {blueprint_file}"}
        
        # Use render CLI for blueprint deployment
        cmd = ["render", "blueprint", "apply", blueprint_file, "--yes"]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                print("✅ Blueprint deployed successfully")
                return {"success": True, "output": result.stdout}
            else:
                print(f"❌ Blueprint deployment failed: {result.stderr}")
                return {"error": result.stderr}
                
        except FileNotFoundError:
            # render CLI not found, use API
            print("Render CLI not found, attempting API deployment...")
            return self._deploy_from_blueprint(blueprint_file)
        except Exception as e:
            return {"error": str(e)}
    
    def _deploy_from_blueprint(self, blueprint_file: str) -> dict:
        """Deploy services from blueprint using API"""
        print("📋 Parsing blueprint and creating services...")
        
        # Parse YAML (basic parsing)
        try:
            import yaml
            with open(blueprint_file, 'r') as f:
                blueprint = yaml.safe_load(f)
        except ImportError:
            print("⚠️ PyYAML not installed, using basic parsing...")
            return self._basic_blueprint_parse(blueprint_file)
        
        services = blueprint.get('services', [])
        databases = blueprint.get('databases', [])
        
        results = {
            "services_created": [],
            "databases_created": [],
            "errors": []
        }
        
        # Create databases first
        for db in databases:
            db_result = self.create_database(db)
            results["databases_created"].append(db_result)
        
        # Create services
        for service in services:
            service_result = self.create_service(service)
            results["services_created"].append(service_result)
        
        return results
    
    def _basic_blueprint_parse(self, blueprint_file: str) -> dict:
        """Basic YAML parsing without PyYAML"""
        # Simple parser for render.yaml
        services = []
        databases = []
        
        with open(blueprint_file, 'r') as f:
            content = f.read()
            # Very basic detection
            if 'type: web' in content:
                services.append({"name": "tracelink-api", "type": "web"})
            if 'type: redis' in content:
                databases.append({"name": "tracelink-redis", "type": "redis"})
            if 'type: postgres' in content or 'postgresMajorVersion' in content:
                databases.append({"name": "tracelink-db", "type": "postgres"})
        
        return {"services": services, "databases": databases, "note": "Basic parse"}
    
    def create_database(self, db_config: dict) -> dict:
        """Create a managed database"""
        name = db_config.get('name', 'tracelink-db')
        db_type = db_config.get('type', 'postgres')
        
        print(f"  🗄️ Creating database: {name} ({db_type})")
        
        # Check if already exists
        existing = self._get_service_by_name(name)
        if existing:
            print(f"  ℹ️  Database already exists: {name}")
            return {"name": name, "status": "exists"}
        
        # Create via API
        data = {
            "name": name,
            "databaseType": "postgresql" if db_type == "postgres" else db_type,
            "plan": db_config.get('plan', 'free'),
            "region": db_config.get('region', 'oregon')
        }
        
        try:
            response = requests.post(
                f"{RENDER_API_BASE}/databases",
                headers=self.headers,
                json=data,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                print(f"  ✅ Database created: {name}")
                return {"name": name, "status": "created", "id": response.json().get('id')}
            else:
                print(f"  ❌ Failed to create database: {response.text}")
                return {"name": name, "status": "error", "error": response.text}
        except Exception as e:
            return {"name": name, "status": "error", "error": str(e)}
    
    def create_service(self, service_config: dict) -> dict:
        """Create a service"""
        name = service_config.get('name', 'tracelink-api')
        service_type = service_config.get('type', 'web')
        
        print(f"  🚀 Creating service: {name} ({service_type})")
        
        # Check if already exists
        existing = self._get_service_by_name(name)
        if existing:
            print(f"  ℹ️  Service already exists: {name}")
            return {"name": name, "status": "exists", "id": existing.get('id')}
        
        # Build service config
        data = {
            "name": name,
            "type": service_type,
            "region": service_config.get('region', 'oregon'),
            "env": service_config.get('env', 'node'),
            "buildCommand": service_config.get('buildCommand', 'npm install'),
            "startCommand": service_config.get('startCommand', 'npm start'),
            "repo": service_config.get('repo', ''),
            "envVars": []
        }
        
        # Add environment variables
        env_vars = service_config.get('envVars', [])
        for env_var in env_vars:
            if 'fromDatabase' not in env_var:
                data['envVars'].append({
                    "key": env_var.get('key'),
                    "value": env_var.get('value', ''),
                    "sync": env_var.get('sync', False)
                })
        
        try:
            response = requests.post(
                f"{RENDER_API_BASE}/services",
                headers=self.headers,
                json=data,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                service_data = response.json()
                print(f"  ✅ Service created: {name}")
                return {"name": name, "status": "created", "id": service_data.get('id')}
            else:
                print(f"  ❌ Failed to create service: {response.text}")
                return {"name": name, "status": "error", "error": response.text}
        except Exception as e:
            return {"name": name, "status": "error", "error": str(e)}
    
    def _get_service_by_name(self, name: str) -> dict:
        """Get service by name"""
        try:
            response = requests.get(
                f"{RENDER_API_BASE}/services",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                services = response.json()
                for service in services:
                    if service.get('name') == name:
                        return service
            return None
        except Exception:
            return None
    
    def deploy_from_git(self, repo_url: str, branch: str = "main") -> dict:
        """Deploy from Git repository"""
        print(f"\n📦 Deploying from Git: {repo_url} (branch: {branch})")
        
        data = {
            "repoUrl": repo_url,
            "branch": branch,
            "name": "tracelink",
            "type": "web",
            "region": "oregon",
            "env": "node",
            "buildCommand": "npm install && npx prisma generate",
            "startCommand": "npm start"
        }
        
        try:
            response = requests.post(
                f"{RENDER_API_BASE}/services",
                headers=self.headers,
                json=data,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                service_data = response.json()
                print("✅ Service deployed successfully!")
                return {"status": "created", "id": service_data.get('id')}
            else:
                return {"error": response.text}
        except Exception as e:
            return {"error": str(e)}
    
    def create_env_group(self, name: str, env_vars: dict) -> dict:
        """Create environment variable group"""
        print(f"\n🔐 Creating environment group: {name}")
        
        data = {
            "name": name,
            "envVars": [{"key": k, "value": v, "sync": False} for k, v in env_vars.items()]
        }
        
        try:
            response = requests.post(
                f"{RENDER_API_BASE}/env-groups",
                headers=self.headers,
                json=data,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                print("✅ Environment group created!")
                return {"status": "created"}
            else:
                print(f"  Note: {response.text}")
                return {"status": "error", "note": response.text}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def list_services(self) -> list:
        """List all services"""
        try:
            response = requests.get(
                f"{RENDER_API_BASE}/services",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            return []
        except Exception:
            return []
    
    def list_databases(self) -> list:
        """List all databases"""
        try:
            response = requests.get(
                f"{RENDER_API_BASE}/databases",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            return []
        except Exception:
            return []


def main():
    parser = argparse.ArgumentParser(description="Deploy TraceLink to Render.com")
    parser.add_argument("--blueprint", action="store_true", help="Deploy using blueprint")
    parser.add_argument("--env-group", action="store_true", help="Create environment group")
    parser.add_argument("--check", action="store_true", help="Check connection and list services")
    parser.add_argument("--api-key", default=RENDER_API_KEY, help="Render API key")
    parser.add_argument("--repo", help="Git repository URL for deployment")
    parser.add_argument("--branch", default="main", help="Git branch to deploy")
    
    args = parser.parse_args()
    
    # Initialize deployer
    deployer = RenderDeployer(args.api_key)
    
    # Check connection first
    if not deployer.check_connection():
        print("❌ Could not connect to Render API")
        sys.exit(1)
    
    if args.check:
        print("\n📋 Current services:")
        services = deployer.list_services()
        for s in services:
            print(f"  - {s.get('name')}: {s.get('type')} ({s.get('status')})")
        
        print("\n📋 Current databases:")
        databases = deployer.list_databases()
        for db in databases:
            print(f"  - {db.get('name')}: {db.get('databaseType')}")
        return
    
    if args.blueprint:
        result = deployer.deploy_blueprint(BLUEPRINT_FILE)
        print(f"\n📊 Deployment result: {json.dumps(result, indent=2)}")
        return
    
    if args.env_group:
        # Load from .env.render if exists
        env_vars = {}
        env_file = Path('.env.render')
        if env_file.exists():
            with open(env_file, 'r') as f:
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        env_vars[key] = value
        
        result = deployer.create_env_group(ENV_GROUP_NAME, env_vars)
        print(f"\n📊 Environment group result: {json.dumps(result, indent=2)}")
        return
    
    if args.repo:
        result = deployer.deploy_from_git(args.repo, args.branch)
        print(f"\n📊 Deployment result: {json.dumps(result, indent=2)}")
        return
    
    # Default: check connection
    print("\n✅ Use --check, --blueprint, --env-group, or --repo to deploy")
    print("\nExample deployments:")
    print("  python deploy_to_render.py --check")
    print("  python deploy_to_render.py --blueprint")
    print("  python deploy_to_render.py --env-group")
    print("  python deploy_to_render.py --repo https://github.com/user/tracelink")


if __name__ == "__main__":
    main()
