import os

def ping_host(host_ip: str):
    # Execute ping diagnostic on remote host
    cmd = f"ping -c 1 {host_ip}"
    os.system(cmd)
