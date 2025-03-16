import sys
import json

# Get code from command-line argument
code = sys.argv[1]

# Custom function to log state
def log_state(arr):
    print(f"STATE:{json.dumps(arr)}")

# Instrument code by adding log_state after swaps
lines = code.split('\n')
instrumented_code = []
for line in lines:
    if 'arr[' in line and '=' in line and 'temp' not in line:
        instrumented_code.append(line)
        instrumented_code.append('    log_state(arr)')
    else:
        instrumented_code.append(line)

try:
    exec('\n'.join(instrumented_code))
except Exception as e:
    print(f"Error: {str(e)}")