#! /bin/bash

gnome-terminal --window --title="Server" -- bash -c '
 echo "=== Starting Server ==="
 cd /home/tcon/active/casino/backend 
 npm run dev
 exec bash
'


gnome-terminal --window --title="Client" -- bash -c '
 echo "==== Starting Client ===="
 cd /home/tcon/active/casino/frontend
 npm run dev
 exec bash
'
