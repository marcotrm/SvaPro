foreach(\App\Models\User::take(10)->get() as $u) echo "User: {$u->email} - {$u->role}\n"; foreach(\App\Models\Employee::take(10)->get() as $e) echo "Employee: {$e->email} - PIN: {$e->pin}\n";
