import { Injectable } from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import { User } from './authentication/user';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ServiceService {
  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  user = new BehaviorSubject<User>(null);

  private password = null;
  private table_name: string ="register.json"
  private expirationTimer: any;

  checkEmail() {
    return this.http.get<any>(environment.apiUrl + this.table_name).pipe(
      map(res => {
        const arr = [];
        for (const r in res) {
          if (res.hasOwnProperty(r)) {
            arr.push({ ...res[r], id: r })
          }
        }
        return arr;
      }));
  }

  createUser(register:any){
  return this.http.post(environment.apiUrl + this.table_name,register);
  }
  signUpForAuth(authData: any){
    return this.http.post(environment.signUpUrl + environment.apikey, authData);
  }
  singInForUser(authData: any) {
    this.password = authData.password;
    return this.http.post<any>(environment.signInUrl + environment.apikey, authData)
    .pipe(
      catchError(this.handleError),
      tap(resData => {
        this.handleAuthentication(
          resData.email, resData.localId, resData.idToken, +resData.expiresIn
        )
      })
    );

  }


  getUsers() {
    return this.http.get<any>(environment.apiUrl + this.table_name).pipe(
      map(res => {
        let arr = [];
        console.log("Before transform:- ",res);
        for(const r in res) {
          if (res.hasOwnProperty(r)) {
            arr.push({ ...res[r], id: r });
          }
        }
        return arr;
      })
    );
  }

  autoLogin() {
    if (localStorage.getItem('user')) {
      // let storageData: string = localStorage.getItem('user') ? localStorage.getItem('user') : "";
      const userData : {
        email: string;
        id: string;
        dbUserId: string,
        _token: string;
        type: string,
        _tokenExpirationDate: string;
      } = JSON.parse(localStorage.getItem('user'));
      const loadUser = new User(
        userData.email,
        userData.id,
        userData.dbUserId,
        userData._token,
        userData.type,
        new Date(userData._tokenExpirationDate));
      if(loadUser.getToken()) {
        this.user.next(loadUser);
        const expirationDuration = new Date(userData._tokenExpirationDate).getTime() - new Date().getTime();
        this.autoLogout(expirationDuration);
      }
    }
  }
  private handleAuthentication(
    email:string,
    userId: string,
    token: string,
    expiresIn: number
    ) {
      this.http.get<any>(environment.apiUrl + this.table_name).pipe(
        map(res => {
          const arr = [];
          for (const r in res) {
            if(res.hasOwnProperty(r)) {
              arr.push({...res[r], id: r})
            }
          }
          return arr;
        })).subscribe(users => {
          let u = users.find(o => o.email == email);
          if (u.password == this.password) {
            const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);
            const user = new User(email, userId, u.id, token, u.type, expirationDate);
            this.user.next(user);
            this.autoLogout(expiresIn * 1000);
            localStorage.setItem('user', JSON.stringify(user));
            if (u.type == 'admin') {
              this.router.navigate(['/admin']);
            } else if (u.type == 'user') {
              this.router.navigate(['/']);
            }
          }
        });
  }

  private handleError(errorRes: HttpErrorResponse) {
    let errorMessage = "An unkown error occure";
    if (!errorRes.error || !errorRes.error.error) {
      return throwError(errorMessage);
    }
    switch (errorRes.error.error.message) {
      case 'EMAIL_NOT_FOUND':
        errorMessage = "Email address not found";
        break;
      case 'INVALID_PASSWORD':
        errorMessage = "Invalid password";
        break;
      case 'USER_DISABLED':
        errorMessage = "Account disabled";
        break;
    }
    //this.LogService.generateLog();
    return throwError(errorMessage);
  }
  public logout() {
    this.user.next(null);
    localStorage.removeItem('user');
    if(this.expirationTimer) {
      clearTimeout(this.expirationTimer);
    }
    this.expirationTimer = null;
    //navigate to login page
  }
  autoLogout(expirationDuration: number) {
    this.expirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

}
