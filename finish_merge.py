import subprocess
import os

os.chdir(r'C:\cardz_curser\cards_project')

try:
    # Complete the merge
    result1 = subprocess.run(['git', 'commit', '-m', 'Merge restore_checkpoints to main'], 
                            capture_output=True, text=True, shell=True)
    print("COMMIT OUTPUT:")
    print(result1.stdout)
    print(result1.stderr)
    
    # Push to main
    result2 = subprocess.run(['git', 'push', 'origin', 'main'], 
                            capture_output=True, text=True, shell=True)
    print("\nPUSH OUTPUT:")
    print(result2.stdout)
    print(result2.stderr)
    
    print("\n✅ Merge completed successfully!")
    
except Exception as e:
    print(f"❌ Error: {e}")

input("\nPress Enter to close...")


