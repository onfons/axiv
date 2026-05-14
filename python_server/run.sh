#!/bin/bash
cd /home/ubuntu/projects/axiv/python_server
uvicorn app.main:app --host 0.0.0.0 --port 8000