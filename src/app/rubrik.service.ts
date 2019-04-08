import {Injectable} from '@angular/core';
import {Response} from '@angular/http';
import {HttpClient, HttpHeaders, HttpErrorResponse} from '@angular/common/http';
import {Observable} from 'rxjs';
import 'rxjs/Rx';
import {catchError, map} from 'rxjs/operators';
import {AppVariables} from './app.constants';

@Injectable()
export class RubrikService {
    public slaDomains: any[] = [];
    public orgArrayMerge: any = [];
    public rubrikDNS = 'shrd1-rbk01-rp.rubrikdemo.com';
    public rubrikAPIToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWNiNzFhMS0yZGIwLTRlZGQtYjA1Mi1kNmQ1NWRlMjBiOTRfMmY2MzFmYjItNzUyMi00ZTcwLWFjNzgtMzk1Y2EzNTIwMmRjIiwiaXNzIjoiMjljYjcxYTEtMmRiMC00ZWRkLWIwNTItZDZkNTVkZTIwYjk0IiwianRpIjoiMGIwYzI3M2MtZjcwOS00YjVjLWJiNTctZTk0YWFjZWMzZDE5In0.yGyQYvzQmGIue_GlD7K8TkCDm46I2bLGalE8XJec3nI';
    private slaFrequencyUnit = [];
    private results: any[] = [];

    constructor(
        private http: HttpClient
    ) {
    }

    public getIOStats(): Observable<any> {
        return this.rubrikGetRequest(
            `https://${this.rubrikDNS}/${AppVariables.internalBaseURL}cluster/me/io_stats?range=-5h`, this.rubrikAPIToken).pipe(
            map(this.extractData)
        );
    }

    public getSLADomains(): Observable<any> {
        this.slaDomains = [];
        let unitMap = ({
            'Hourly': 'hours',
            'Yearly': 'years',
            'Daily': 'days',
            'Monthly': 'months',
            'Minutes': 'minutes'
        });
        this.rubrikGetRequest(
            `https://${this.rubrikDNS}/${AppVariables.v1BaseURL}${AppVariables.slaDomain}`, this.rubrikAPIToken).subscribe(
            slaObj => {
                for (let i = 0; i < slaObj['total']; i++) {
                    let slaId = slaObj['data'][i]['id'];
                    let slaName = slaObj['data'][i]['name'];
                    let freq = [];
                    console.log(slaName);
                    for (let n = 0; n < slaObj['data'][i]['frequencies'].length; n++) {
                        if (slaObj['data'][i]['frequencies'][n]['frequency'] === 1) {
                            this.slaFrequencyUnit = unitMap[slaObj['data'][i]['frequencies'][n]['timeUnit']].slice(0, -1);
                        } else {
                            this.slaFrequencyUnit = unitMap[slaObj['data'][i]['frequencies'][n]['timeUnit']];
                        }
                        let slaFrequency = slaObj['data'][i]['frequencies'][n]['frequency'];
                        let slaRetention = slaObj['data'][i]['frequencies'][n]['retention'];
                        let slaRetentionUnit = unitMap[slaObj['data'][i]['frequencies'][n]['timeUnit']];

                        freq.push({
                                frequency_unit: this.slaFrequencyUnit,
                                retention_unit: slaRetentionUnit,
                                frequency: slaFrequency,
                                retention: slaRetention
                            }
                        );
                    }
                    this.slaDomains.push({
                        id: slaId,
                        name: slaName,
                        frequencies: freq
                    });
                }
                this.slaDomains.push({
                    id: 'UNPROTECTED',
                    name: 'Do Not Protect',
                    frequencies: []
                });
            });
        return Observable.of(this.slaDomains);
    }

    public submitSlaAssignment(rubrikDNS: string, vapps: any, sla: any) {
        let results = [];
        results.length = 0;
        let slaAssigned: any = {'configuredSlaDomainId': sla};
        for (let v = 0; v < vapps.length; v++) {
            let vapp = vapps[v];
            let vappId = vapp['rubrik_vapp_id'];
            let i = this.orgArrayMerge.findIndex(item => item.rubrik_vapp_id === vappId);
            this.orgArrayMerge[i].rubrik_vapp_sla_name = 'Modifying';
            this.rubrikPatchRequest(
                `https://${rubrikDNS}/${AppVariables.internalBaseURL}vcd/vapp/${vappId}`, slaAssigned, this.rubrikAPIToken).subscribe(
                result => {
                    let res = result;
                    this.orgArrayMerge[i].rubrik_vapp_sla_name = res['configuredSlaDomainName'] || 'Modifying';
                    this.orgArrayMerge[i].rubrik_vapp_sla_id = res['configuredSlaDomainId'];
                    this.results.push(res);
                });
        }
        return this.results;
    }

    /**
     * @Function hashSalt - Password Hash and Salt Function
     *
     * Hashes and Salts the password provided for Rubrik and stores it Encrypted AES256
     *
     * @param {?} password - Rubrik Credential
     * @param {?} tenantId - Tenant ID from vCD
     * @return {?} Returns Encrypted String
     */

    public hashSalt(password: string, tenantId: string) {
        const key = tenantId.toString();

        return CryptoJS.AES.encrypt(password.toString(), key,
            {
                keySize: 256 / 8,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

    }

    /**
     * @Function hashSaltDecrypt - Password Hash and Salt Decrypt Function
     *
     * Decrypts the previously Hash and Salted password
     *
     * @param {?} saltedPass - Rubrik Credential in Encrypted Format
     * @param {?} tenantId - Tenant ID from vCD
     * @return {?} Returns Decrypted String
     */

    public hashSaltDecrypt(saltedPass: string, tenantId: string) {
        const key = tenantId.toString();
        const decrypted = CryptoJS.AES.decrypt(saltedPass, key, {
            keySize: 256 / 8,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    }

    /**
     * @Function authRubrik - Authentication Function for Rubrik API
     *
     * Receive Logon Credentials, API Endpoint and/or Token to Authenticate with
     *
     * @param {?} url - API Endpoint URI
     * @param {?} body - API Payload for Rubrik Auth
     * @param {?} username - Username to Authenticate with
     * @param {?} password - Password for said user
     * @param {?} userToken - API Token for Rubrik
     * @return {?} API Response from Rubrik
     */

    public authRubrik(url: string, body: string, username: string, password: string, userToken: string): Observable<any> {

        const userb64Auth = btoa(username + ':' + password);
        const headers = new HttpHeaders({
            'Authorization': 'Basic ' + userb64Auth,
            'Content-Type': 'application/json'
        });

        let pBody = JSON.stringify(body);

        return this.http
            .post(url, pBody, {headers: headers})
            .pipe(
                map(this.extractData),
                catchError(this.handleError)
            );
    }

    /**
     * @Function rubrikGetRequest - Generic API Get Function for Rubrik API
     *
     * Receive URL and Bearer Token to send Get Requests
     *
     * @param {?} url - API Endpoint URI
     * @param {?} token - API Bearer Token
     * @return {?} API Response from Rubrik
     */

    public rubrikGetRequest(url: string, token: string): Observable<any> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        });
        let encodedUrl = encodeURI(url);

        return this.http
            .get(encodedUrl, {headers: headers})
            .pipe(
                map(this.extractData),
                catchError(this.handleError)
            );
    }

    /**
     * @Function rubrikPostRequest - Generic API POST Function for Rubrik API
     *
     * Receive URL and Bearer Token to send Get Requests
     *
     * @param {?} url - API Endpoint URL
     * @param {?} body - API Payload for Rubrik Auth
     * @param {?} token - API Bearer Token
     * @return {?} API Response from Rubrik
     */

    public rubrikPostRequest(url: string, body: object, token: string): Observable<any> {

        const headers = new HttpHeaders({
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        });
        let encodedUrl = encodeURI(url);
        let pBody = JSON.stringify(body);

        // console.log(headers);

        return this.http
            .post(encodedUrl, pBody, {headers: headers})
            .pipe(
                map(this.extractData),
                catchError(this.handleError)
            );
    }

    /**
     * @Function rubrikPatchRequest - Generic API Patch Function for Rubrik API
     *
     * Receive URL and Bearer Token to send Get Requests
     *
     * @param {?} url - API Endpoint URL
     * @param {?} body - API Payload for Rubrik Auth
     * @param {?} token - API Bearer Token
     * @return {?} API Response from Rubrik
     */

    public rubrikPatchRequest(url: string, body: string, token: string): Observable<any> {

        const headers = new HttpHeaders({
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/x-www-form-urlencoded'
        });
        let encodedUrl = encodeURI(url);
        let pBody = JSON.stringify(body);
        // console.log(headers);

        return this.http
            .patch(encodedUrl, pBody, {headers: headers})
            .pipe(
                map(this.extractData),
                catchError(this.handleError)
            );
    }

    /**
     * @Function rubrikDeleteRequest - Generic API Patch Function for Rubrik API
     *
     * Receive URL and Bearer Token to send Get Requests
     *
     * @param {?} url - API Endpoint URL
     * @param {?} body - API Payload for Rubrik Auth
     * @param {?} token - API Bearer Token
     * @return {?} API Response from Rubrik
     */

    public rubrikDeleteRequest(url: string, body: string, token: string): Observable<any> {

        const headers = new HttpHeaders({
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/x-www-form-urlencoded',
        });
        let encodedUrl = encodeURI(url);
        let pBody = JSON.stringify(body);
        // console.log(headers);

        return this.http
            .delete(encodedUrl, {headers: headers})
            .pipe(
                map(this.extractData),
                catchError(this.handleError)
            );
    }

    /**
     * @Function extractData - JSON Parse Function
     *
     * Receive URL and Bearer Token to send Get Requests
     *
     * @param {?} res - API Response
     * @return {?} resolved JSON Body
     */

    private extractData(res: Response) {
        let body = res;
        // console.log(body);
        return body || {};
    }

    /**
     * @Function handleError - API Error Handling
     *
     * Uses native HTTPClient to handle API Errors
     *
     * @param {?} error - Error Function
     * @return {?} Fully Qualified Error Message
     */

    private handleError(error: HttpErrorResponse) {
        // In a real world app, you might use a remote logging infrastructure
        let errMsg: string;
        if (error instanceof Response) {
            const body = error.json() || '';
            const err = body.error || JSON.stringify(body);
            errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
        } else {
            errMsg = error.message ? error.message : error.toString();
        }
        console.error(errMsg);
        return Observable.throw(errMsg);
    }
}

