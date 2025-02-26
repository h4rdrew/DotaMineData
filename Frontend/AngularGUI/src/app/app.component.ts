import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { sqlite3 as SQLite } from 'sqlite3';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'AngularGUI';

  constructor(private sqlite: SQLite) {
    sqlite = new SQLite
  }

  loadDB() {}
}
